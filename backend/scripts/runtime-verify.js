#!/usr/bin/env node
/**
 * Runtime Verification — the gate that actually RUNS things.
 * ─────────────────────────────────────────────────────────
 * Every other pre-deploy check is static: `tsc` proves types compile, vitest proves mocked
 * units behave, `vite build` proves the bundle links. None of them execute one line of SQL or
 * boot the server. That gap shipped a groomer-registration bug that no static check could
 * possibly have seen (2026-07-27): migration 030 widened a CHECK constraint, and the legacy
 * self-heal in database.ts silently reverted it on every boot.
 *
 * This script closes that gap by building a throwaway PostgreSQL exactly the way production
 * gets built, then driving the real server over real HTTP.
 *
 *   PHASE 1  fresh-install path — docker/init.sql applied as ONE transaction (production's
 *            atomic apply: any single error wipes the whole schema)
 *   PHASE 2  upgrade path — every backend/migrations/*.sql on top, in order, each in its own
 *            transaction, exactly like the real runner
 *   PHASE 3  schema snapshot taken here, BEFORE the server has ever connected
 *   PHASE 4  boot the real compiled server (backend/dist) against that database
 *   PHASE 5  DRIFT CHECK — re-snapshot and fail if the server's startup self-heal CHANGED or
 *            REMOVED anything the migrations established. This is the generic form of the
 *            2026-07-27 bug and catches the entire class, not just roles.
 *   PHASE 6  HTTP smoke — register every self-registerable role, log in, read permissions.
 *            The role list is PARSED FROM validation.ts so it cannot drift from the source
 *            of truth: add a role there and this test automatically covers it.
 *
 * Run: npm run verify:runtime  (from backend/)
 *
 * Requires a local PostgreSQL. If one cannot be found this FAILS LOUDLY rather than skipping —
 * a check that silently no-ops is how this class of bug reaches production in the first place.
 * Genuine emergency override: SKIP_RUNTIME_VERIFY=1 (say so in the commit message).
 */

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');
const INIT_SQL = path.join(ROOT, 'docker', 'init.sql');
const MIGRATIONS_DIR = path.join(BACKEND, 'migrations');
const SCHEMA = 'vetcare_dev'; // deployments are schema-scoped; `public` would hide schema bugs

const RED = '\x1b[31m', GREEN = '\x1b[32m', CYAN = '\x1b[36m', YELLOW = '\x1b[33m';
const DIM = '\x1b[2m', RESET = '\x1b[0m';

const log = m => console.log(m);
const step = m => process.stdout.write(`  ${m} ... `);
const ok = (extra = '') => console.log(`${GREEN}✓${RESET}${extra ? ` ${DIM}${extra}${RESET}` : ''}`);
const bad = () => console.log(`${RED}✗${RESET}`);

// ── Locate PostgreSQL binaries ────────────────────────────────────────────
function findPgBin() {
  if (process.env.PGBIN && fs.existsSync(path.join(process.env.PGBIN, 'initdb.exe')) ||
      process.env.PGBIN && fs.existsSync(path.join(process.env.PGBIN, 'initdb'))) {
    return process.env.PGBIN;
  }
  const candidates = [];
  // Windows default installs, newest major first
  for (const drive of ['C:', 'D:', 'E:', 'F:']) {
    for (const major of [18, 17, 16, 15, 14, 13]) {
      candidates.push(`${drive}\\Program Files\\PostgreSQL\\${major}\\bin`);
    }
  }
  // POSIX
  candidates.push('/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin',
    '/usr/local/bin', '/usr/bin', '/opt/homebrew/bin');

  for (const dir of candidates) {
    const exe = process.platform === 'win32' ? 'initdb.exe' : 'initdb';
    if (fs.existsSync(path.join(dir, exe))) return dir;
  }
  return null;
}

const PGBIN = findPgBin();
const pg = name => path.join(PGBIN, process.platform === 'win32' ? `${name}.exe` : name);

// ── Pick a free TCP port ──────────────────────────────────────────────────
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Cluster lifecycle ─────────────────────────────────────────────────────
let DATA_DIR = null;
let PG_PORT = null;
let pgProc = null;
let serverProc = null;

function pgRun(bin, args, opts = {}) {
  // maxBuffer: a full-schema snapshot is megabytes of JSON; the 1MB default throws ENOBUFS.
  return execFileSync(pg(bin), args,
    { encoding: 'utf8', stdio: 'pipe', timeout: 180000, maxBuffer: 128 * 1024 * 1024, ...opts });
}

function psql(db, sqlOrFile, { file = false, singleTx = false } = {}) {
  const args = ['-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-q', '-X'];
  if (singleTx) args.push('--single-transaction');
  if (file) args.push('-f', sqlOrFile);
  else args.push('-c', sqlOrFile);
  return pgRun('psql', args);
}

function killTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(proc.pid, 'SIGKILL');
    }
  } catch { /* already gone */ }
}

function psqlJson(db, sql) {
  // -A (unaligned) + -t (tuples only) are REQUIRED: psql's default aligned output wraps long
  // values across lines with '+' continuation markers, which shreds the JSON.
  const out = pgRun('psql', ['-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-X', '-A', '-t',
    '-c', `SELECT COALESCE(json_agg(t), '[]'::json)::text FROM (${sql}) t;`]);
  return JSON.parse(out.trim() || '[]');
}

async function startCluster() {
  DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vetcare-verify-'));
  const dataPath = path.join(DATA_DIR, 'pgdata');
  pgRun('initdb', ['-D', dataPath, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8'], { stdio: 'ignore' });
  PG_PORT = await freePort();

  // Spawn `postgres` directly rather than `pg_ctl start`: on Windows pg_ctl leaves the
  // long-lived server holding the inherited stdio pipes, so execFileSync never sees EOF and
  // blocks forever. Spawning detached with stdio:'ignore' also gives us a pid to kill.
  pgProc = spawn(pg('postgres'),
    ['-D', dataPath, '-p', String(PG_PORT), '-c', 'listen_addresses=127.0.0.1'],
    { stdio: 'ignore', windowsHide: true });
  pgProc.unref();

  for (let i = 0; i < 60; i++) {
    try {
      pgRun('pg_isready', ['-h', '127.0.0.1', '-p', String(PG_PORT)], { stdio: 'ignore', timeout: 5000 });
      return;
    } catch { await sleep(500); }
  }
  throw new Error('PostgreSQL never became ready');
}

function stopEverything() {
  killTree(serverProc);
  killTree(pgProc);
  if (DATA_DIR) {
    for (let i = 0; i < 8; i++) {
      try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); break; }
      catch { /* Windows holds file locks briefly after kill */ }
    }
  }
}

// ── Schema snapshot (the drift detector) ──────────────────────────────────
function snapshot(db) {
  const constraints = psqlJson(db, `
    SELECT c.relname AS tbl, con.conname AS name, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '${SCHEMA}'
    ORDER BY 1, 2, 3`);
  const columns = psqlJson(db, `
    SELECT table_name AS tbl, column_name AS name, data_type AS def
    FROM information_schema.columns
    WHERE table_schema = '${SCHEMA}'
    ORDER BY 1, 2`);
  return { constraints, columns };
}

/**
 * Compares two snapshots. ADDITIONS are fine — the legacy self-heal legitimately creates
 * objects that init.sql predates. CHANGES and REMOVALS are not: those mean startup code
 * overwrote what a tracked migration established, which is invisible in every static check
 * and in the migration log.
 */
/**
 * Element ORDER inside `= ANY (ARRAY[...])` carries no meaning — a rebuilt CHECK listing the
 * same values in a different order is semantically identical. Sort them so the diff reports
 * only genuine changes (a value added or, far more dangerously, dropped).
 */
function normalizeDef(def) {
  return String(def).replace(/ARRAY\[([^\]]*)\]/g, (_, inner) => {
    const parts = inner.split(',').map(s => s.trim()).filter(Boolean).sort();
    return `ARRAY[${parts.join(', ')}]`;
  });
}

function diffSnapshots(before, after) {
  const problems = [];
  for (const kind of ['constraints', 'columns']) {
    const key = r => `${r.tbl}.${r.name}`;
    const afterMap = new Map(after[kind].map(r => [key(r), r.def]));
    for (const row of before[kind]) {
      const k = key(row);
      if (!afterMap.has(k)) {
        problems.push({ kind, key: k, was: row.def, now: '(REMOVED by server startup)' });
      } else if (normalizeDef(afterMap.get(k)) !== normalizeDef(row.def)) {
        problems.push({ kind, key: k, was: row.def, now: afterMap.get(k) });
      }
    }
  }
  return problems;
}

// ── Registerable roles, parsed from the Joi schema (single source of truth) ──
function registerableRoles() {
  const src = fs.readFileSync(path.join(BACKEND, 'src', 'middleware', 'validation.ts'), 'utf8');
  // The register schema's role field, e.g.
  //   role: Joi.string().valid('pet_owner', 'farmer', ..., 'groomer').default('pet_owner')
  const m = src.match(/role:\s*Joi\.string\(\)\s*\.valid\(([^)]*)\)\s*\.default\(/);
  if (!m) throw new Error('Could not parse the registration role list from validation.ts — ' +
    'if the schema was refactored, update registerableRoles() so this stays in sync.');
  const roles = [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
  if (roles.length === 0) throw new Error('Parsed an empty role list from validation.ts');
  return roles;
}

// ── HTTP helper (no external deps) ────────────────────────────────────────
async function http(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

// ── Main ──────────────────────────────────────────────────────────────────
(async function main() {
  if (process.env.SKIP_RUNTIME_VERIFY === '1') {
    log(`${YELLOW}⚠ Runtime Verification SKIPPED via SKIP_RUNTIME_VERIFY=1.${RESET}`);
    log(`${YELLOW}  Static checks cannot see SQL or startup behaviour. Justify this in the commit message.${RESET}`);
    process.exit(0);
  }

  log(`\n${CYAN}━━━ Runtime Verification (real Postgres + real server) ━━━${RESET}\n`);

  if (!PGBIN) {
    log(`${RED}✗ No local PostgreSQL found.${RESET}`);
    log(`  This gate runs the schema and the server for real; it cannot be faked.`);
    log(`  Install PostgreSQL, or point PGBIN at its bin directory:`);
    log(`    ${DIM}PGBIN="C:\\Program Files\\PostgreSQL\\18\\bin" npm run verify:runtime${RESET}`);
    log(`  Emergency override (explain it in the commit): ${DIM}SKIP_RUNTIME_VERIFY=1${RESET}\n`);
    process.exit(1);
  }

  const distEntry = path.join(BACKEND, 'dist', 'index.js');
  if (!fs.existsSync(distEntry)) {
    log(`${RED}✗ backend/dist not built — run \`npm run build\` in backend/ first.${RESET}\n`);
    process.exit(1);
  }

  let failed = false;
  const fail = (title, detailLines = []) => {
    failed = true;
    bad();
    log(`\n${RED}  ${title}${RESET}`);
    for (const l of detailLines) log(`    ${DIM}${l}${RESET}`);
    log('');
  };

  try {
    step(`Starting throwaway PostgreSQL ${DIM}(${path.basename(PGBIN)})${RESET}`);
    await startCluster();
    psql('postgres', 'CREATE DATABASE verifydb');
    psql('verifydb', `CREATE SCHEMA ${SCHEMA}`);
    ok(`port ${PG_PORT}`);

    // ── PHASE 1: fresh install, atomic like production ──
    step('PHASE 1  init.sql (single transaction, fresh install)');
    const scoped = path.join(DATA_DIR, 'init_scoped.sql');
    fs.writeFileSync(scoped,
      `SET search_path TO ${SCHEMA}, public;\n` + fs.readFileSync(INIT_SQL, 'utf8'));
    try {
      psql('verifydb', scoped, { file: true, singleTx: true });
      ok();
    } catch (e) {
      fail('init.sql failed — a fresh deploy would end up with NO schema at all (atomic apply).',
        String(e.stderr || e.message).split('\n').filter(Boolean).slice(0, 12));
    }

    // ── PHASE 2: upgrade path ──
    if (!failed) {
      const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
      step(`PHASE 2  ${files.length} migration(s), in order`);
      const broken = [];
      for (const f of files) {
        const tmp = path.join(DATA_DIR, 'mig.sql');
        fs.writeFileSync(tmp,
          `SET search_path TO ${SCHEMA}, public;\n` + fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
        try {
          psql('verifydb', tmp, { file: true, singleTx: true });
        } catch (e) {
          broken.push(`${f}: ${String(e.stderr || e.message).split('\n').filter(Boolean)[0] || 'failed'}`);
        }
      }
      if (broken.length) fail(`${broken.length} migration(s) failed on a real database.`, broken);
      else ok();
    }

    // ── PHASE 3/4/5: snapshot → boot → drift ──
    let baseline = null;
    let port = null;
    if (!failed) {
      step('PHASE 3  Schema snapshot (before the server has ever connected)');
      baseline = snapshot('verifydb');
      ok(`${baseline.constraints.length} constraints, ${baseline.columns.length} columns`);

      step('PHASE 4  Booting the real compiled server');
      port = await freePort();
      serverProc = spawn(process.execPath, [distEntry], {
        cwd: BACKEND,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Individual params, NOT DATABASE_URL: config forces SSL whenever DATABASE_URL is
          // set, and a local cluster rejects SSL.
          DATABASE_URL: '', DB_HOST: '127.0.0.1', DB_PORT: String(PG_PORT),
          DB_USER: 'postgres', DB_PASSWORD: '', DB_NAME: 'verifydb', DB_SCHEMA: SCHEMA,
          MOCK_DB: 'false', MOCK_REDIS: 'true',
          SEED_ON_STARTUP: 'false', FORCE_RESEED: 'false',
          // Never let a verification run touch a real provider — a unit test once sent a REAL
          // email through the developer's Gmail (2026-07-10). Blanking these forces log-only.
          RESEND_API_KEY: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
          FEATURE_EMAIL_NOTIFICATIONS: 'false',
          ENABLE_SELF_PING: 'false',
          PORT: String(port), NODE_ENV: 'development',
        },
      });
      let serverLog = '';
      serverProc.stdout.on('data', d => { serverLog += d.toString(); });
      serverProc.stderr.on('data', d => { serverLog += d.toString(); });

      let healthy = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          if (r.status === 200) { healthy = true; break; }
        } catch { /* not up yet */ }
        await sleep(1000);
      }
      if (!healthy) {
        fail('Server never became healthy against a real database.',
          serverLog.split('\n').filter(Boolean).slice(-15));
      } else {
        ok();
        // Let every deferred startup task finish before snapshotting.
        await sleep(3000);

        step('PHASE 5  Schema drift after startup');
        const problems = diffSnapshots(baseline, snapshot('verifydb'));
        if (problems.length) {
          const lines = [];
          for (const p of problems.slice(0, 10)) {
            lines.push(`${p.key}`);
            lines.push(`   migrations set: ${p.was}`);
            lines.push(`   after startup:  ${p.now}`);
          }
          if (problems.length > 10) lines.push(`... and ${problems.length - 10} more`);
          lines.push('');
          lines.push('Server startup code overwrote schema that a tracked migration established.');
          lines.push('Look in backend/src/utils/database.ts (ensureSchemaPublic / ensure*Table):');
          lines.push('those blocks run on EVERY boot, AFTER migrations, and are not tracked.');
          fail(`${problems.length} schema object(s) CHANGED or REMOVED by server startup.`, lines);
        } else {
          ok('migrations survived startup');
        }
      }
    }

    // ── PHASE 6: HTTP smoke over the real API ──
    // Runs even if PHASE 5 failed: drift and user-facing breakage are independent diagnostics,
    // and seeing both ("the constraint was reverted" AND "so this role cannot register") makes
    // the cause-and-effect obvious instead of leaving it to be inferred.
    if (port) {
      const roles = registerableRoles();
      step(`PHASE 6  Registering all ${roles.length} self-registerable role(s)`);
      const problems = [];
      const base = `http://127.0.0.1:${port}/api/v1`;

      for (const role of roles) {
        // Fixtures must satisfy the real Joi rules: a resolvable-looking TLD, and names
        // restricted to /^[a-zA-Z\s'-]+$/ (so no underscores from the role slug).
        const safeName = role.replace(/_/g, ' ');
        const email = `verify.${role.replace(/_/g, '.')}.${Date.now()}@example.com`;
        const body = {
          firstName: 'Verify', lastName: safeName, email, phone: '5550000000',
          password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true,
        };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-1';

        const reg = await http('POST', `${base}/auth/register`, body);
        if (reg.status >= 400 || !reg.json?.success) {
          const detail = reg.json?.error?.details?.originalError || reg.json?.message || `HTTP ${reg.status}`;
          problems.push(`role '${role}' cannot register: ${detail}`);
          continue;
        }
        // Roles needing admin approval get no token — that is correct, not a failure.
        if (!reg.json?.data?.token) continue;

        const login = await http('POST', `${base}/auth/login`, { email, password: 'Password1' });
        if (login.status !== 200 || !login.json?.data?.token) {
          problems.push(`role '${role}' registered but cannot log in (HTTP ${login.status})`);
          continue;
        }
        const perms = await http('GET', `${base}/permissions/my`, null, login.json.data.token);
        if (perms.status !== 200 || !Array.isArray(perms.json?.data?.permissions)) {
          problems.push(`role '${role}' cannot read its permissions (HTTP ${perms.status})`);
        } else if (perms.json.data.permissions.length === 0) {
          problems.push(`role '${role}' resolves to ZERO permissions — it would see an empty app`);
        }
      }

      if (problems.length) {
        fail(`${problems.length} role(s) are broken end-to-end.`, problems);
      } else {
        ok(roles.join(', '));
      }
    }
  } catch (err) {
    fail('Runtime verification crashed.', String(err.stack || err.message).split('\n').slice(0, 12));
  } finally {
    stopEverything();
  }

  log('');
  if (failed) {
    log(`${RED}━━━ RUNTIME VERIFICATION FAILED ━━━${RESET}`);
    log(`${YELLOW}These are real failures against a real database — they WILL happen on deploy.${RESET}\n`);
    process.exit(1);
  }
  log(`${GREEN}━━━ RUNTIME VERIFICATION PASSED ━━━${RESET}\n`);
})();

process.on('exit', stopEverything);
process.on('SIGINT', () => { stopEverything(); process.exit(130); });
