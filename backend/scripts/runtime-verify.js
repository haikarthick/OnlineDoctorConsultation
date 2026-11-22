#!/usr/bin/env node
/**
 * Runtime Verification - the gate that actually RUNS things.
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
 *   PHASE 1  fresh-install path - docker/init.sql applied as ONE transaction (production's
 *            atomic apply: any single error wipes the whole schema)
 *   PHASE 2  upgrade path - every backend/migrations/*.sql on top, in order, each in its own
 *            transaction, exactly like the real runner
 *   PHASE 3  schema snapshot taken here, BEFORE the server has ever connected
 *   PHASE 4  boot the real compiled server (backend/dist) against that database
 *   PHASE 5  DRIFT CHECK - re-snapshot and fail if the server's startup self-heal CHANGED or
 *            REMOVED anything the migrations established. This is the generic form of the
 *            2026-07-27 bug and catches the entire class, not just roles.
 *   PHASE 6  HTTP smoke - register every self-registerable role, log in, read permissions.
 *            The role list is PARSED FROM validation.ts so it cannot drift from the source
 *            of truth: add a role there and this test automatically covers it.
 *   PHASE 7  BROWSER - Playwright drives the real SPA the server is serving. PHASE 6 proves
 *            the API accepts a role; only this proves the SCREEN offers it, the form submits,
 *            and the app the user lands in renders (no raw i18n keys, no console errors).
 *
 * Run: npm run verify:runtime  (from backend/)
 *
 * Requires a local PostgreSQL. If one cannot be found this FAILS LOUDLY rather than skipping -
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

/**
 * --full: seed the demo dataset and run the ENTIRE e2e suite (462 tests) instead of just the
 * @critical journeys. Far too slow for a push gate, but it gives the older specs - which need a
 * seeded, already-running app and were wired to nothing - a real way to be executed on demand:
 *   cd backend && npm run verify:runtime:full
 */
const FULL = process.argv.includes('--full');

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
  // POSIX - enumerate whatever major versions are actually installed (newest first) rather
  // than guessing, so a CI runner that ships PG 17 or 18 is found without editing this list.
  try {
    const base = '/usr/lib/postgresql';
    for (const v of fs.readdirSync(base).sort((a, b) => parseInt(b, 10) - parseInt(a, 10))) {
      candidates.push(path.join(base, v, 'bin'));
    }
  } catch { /* not a Debian-style layout */ }
  candidates.push('/usr/local/bin', '/usr/bin', '/opt/homebrew/bin');

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
let PG_LOG = null;
// Held open for the server's stdout/stderr. MUST be closed before the data dir is deleted:
// while this fd is open, Node itself has a handle on postgres.log, so rmSync fails on Windows
// no matter how many times it retries - which is why every run used to strand its cluster.
let PG_LOG_FD = null;
let serverProc = null;

function pgRun(bin, args, opts = {}) {
  // maxBuffer: a full-schema snapshot is megabytes of JSON; the 1MB default throws ENOBUFS.
  // windowsHide: psql/initdb/pg_ctl are console executables, and Node's default
  // (windowsHide: false) pops a real console window for each one. This helper runs dozens of
  // times per verification, so without it the developer's screen fills with command prompts
  // they cannot type into and cannot dismiss. Nothing here is interactive - all output is
  // piped back and rendered by this script.
  return execFileSync(pg(bin), args,
    { encoding: 'utf8', stdio: 'pipe', timeout: 180000, maxBuffer: 128 * 1024 * 1024,
      windowsHide: true, ...opts });
}

function psql(db, sqlOrFile, { file = false, singleTx = false } = {}) {
  const args = ['-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-q', '-X'];
  if (singleTx) args.push('--single-transaction');
  if (file) args.push('-f', sqlOrFile);
  else args.push('-c', sqlOrFile);
  return pgRun('psql', args);
}

/**
 * Runs a child process WITHOUT blocking this process's event loop, and resolves/rejects with its
 * captured output. This matters: the harness server's stdout/stderr are pipes that THIS process
 * drains through event handlers. A synchronous call (execFileSync) freezes that draining, the
 * server's console pipe fills after ~64KB of request logging, the server blocks on its next log
 * line and every request hangs - which looked exactly like "the app froze" during the whole-app
 * browser sweep. Never wait synchronously for anything while the server is up.
 */
function runAsync(file, args, { cwd, env, timeout }) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      killTree(child);
      reject(Object.assign(new Error(`timed out after ${timeout}ms`), { stdout, stderr }));
    }, timeout);
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(Object.assign(e, { stdout, stderr })); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`exited with code ${code}`), { stdout, stderr }));
    });
  });
}

function killTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true });
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
  // blocks forever. Spawning directly also gives us a pid to kill.
  const args = ['-D', dataPath, '-p', String(PG_PORT), '-c', 'listen_addresses=127.0.0.1'];

  // Debian/Ubuntu builds are compiled with a default unix_socket_directories of
  // /var/run/postgresql, which does not exist (or is not writable) for an unprivileged CI
  // user - postgres then exits immediately at startup. Point it at our own temp directory.
  // Windows has no unix sockets, so the option is POSIX-only.
  if (process.platform !== 'win32') {
    args.push('-c', `unix_socket_directories=${dataPath}`);
  }

  // Log to a file rather than 'ignore': when the server refuses to start, this file is the
  // ONLY explanation available, and swallowing it turns a one-line fix into a guessing game.
  PG_LOG = path.join(DATA_DIR, 'postgres.log');
  PG_LOG_FD = fs.openSync(PG_LOG, 'a');
  pgProc = spawn(pg('postgres'), args,
    // detached so KEEP_DB=1 can leave a live cluster behind for inspection after we exit
    { stdio: ['ignore', PG_LOG_FD, PG_LOG_FD], windowsHide: true, detached: true });
  pgProc.unref();

  for (let i = 0; i < 60; i++) {
    try {
      pgRun('pg_isready', ['-h', '127.0.0.1', '-p', String(PG_PORT)], { stdio: 'ignore', timeout: 5000 });
      return;
    } catch { await sleep(500); }
  }

  let why = '';
  try { why = fs.readFileSync(PG_LOG, 'utf8').trim().split('\n').slice(-15).join('\n'); } catch { /* no log */ }
  throw new Error(`PostgreSQL never became ready.\nServer log:\n${why || '(empty)'}`);
}

function stopEverything() {
  // KEEP_DB=1 leaves the cluster running so a failing run can actually be inspected.
  // Without this, the only evidence of what the database looked like is gone the moment the
  // gate exits - which turns every seed/FK question into guesswork.
  if (process.env.KEEP_DB === '1' && DATA_DIR) {
    killTree(serverProc);
    console.log(`\n  ${YELLOW}KEEP_DB=1 - cluster left running for inspection${RESET}`);
    console.log(`  psql -h 127.0.0.1 -p ${PG_PORT} -U postgres -d verifydb`);
    console.log(`  data dir: ${DATA_DIR}`);
    console.log(`  stop it with: taskkill /pid ${pgProc && pgProc.pid} /T /F\n`);
    return;
  }
  killTree(serverProc);
  killTree(pgProc);
  // Release our own handle on postgres.log before trying to delete the directory that holds it.
  if (PG_LOG_FD !== null) {
    try { fs.closeSync(PG_LOG_FD); } catch { /* already closed */ }
    PG_LOG_FD = null;
  }
  if (DATA_DIR) {
    // Windows holds file locks for a moment after the kill, so the retries have to WAIT.
    // They previously ran back-to-back with no delay, so all 8 attempts finished inside a
    // millisecond and every failing run stranded a ~78 MB cluster in %TEMP% forever.
    // Teardown is synchronous (it runs from a finally/exit path), hence the Atomics sleep.
    let removed = false;
    for (let i = 0; i < 8 && !removed; i++) {
      try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); removed = true; }
      catch {
        try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } catch { /* noop */ }
      }
    }
    if (!removed) {
      console.log(`  ${YELLOW}note:${RESET} could not delete ${DATA_DIR} - remove it manually.`);
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
  // data_type + is_nullable + column_default: a self-heal block that quietly changes a DEFAULT
  // (say, a status column's initial value) is the same class of silent drift as a CHECK rewrite,
  // and would otherwise slip through this gate.
  const columns = psqlJson(db, `
    SELECT table_name AS tbl, column_name AS name,
           data_type || ' | nullable=' || is_nullable ||
             ' | default=' || COALESCE(column_default, '(none)') AS def
    FROM information_schema.columns
    WHERE table_schema = '${SCHEMA}'
    ORDER BY 1, 2`);
  return { constraints, columns };
}

/**
 * Compares two snapshots. ADDITIONS are fine - the legacy self-heal legitimately creates
 * objects that init.sql predates. CHANGES and REMOVALS are not: those mean startup code
 * overwrote what a tracked migration established, which is invisible in every static check
 * and in the migration log.
 */
/**
 * Element ORDER inside `= ANY (ARRAY[...])` carries no meaning - a rebuilt CHECK listing the
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
  // registerSchema lives in validation/auth.ts, not validation.ts directly, since 2026-11-13
  // (validation.ts split into validation/<module>.ts - validation.ts is now just a barrel).
  const src = fs.readFileSync(path.join(BACKEND, 'src', 'middleware', 'validation', 'auth.ts'), 'utf8');
  // The register schema's role field, e.g.
  //   role: Joi.string().valid('pet_owner', 'farmer', ..., 'groomer').default('pet_owner')
  const m = src.match(/role:\s*Joi\.string\(\)\s*\.valid\(([^)]*)\)\s*\.default\(/);
  if (!m) throw new Error('Could not parse the registration role list from validation/auth.ts - ' +
    'if the schema was refactored, update registerableRoles() so this stays in sync.');
  const roles = [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
  if (roles.length === 0) throw new Error('Parsed an empty role list from validation.ts');
  return roles;
}

/**
 * Waits for the startup demo seed to FINISH.
 *
 * SEED_ON_STARTUP=true (set on vetcare-dev and vetcare-demo) makes fixDemoPasswords apply
 * large chunks of docker/seed-demo-data.sql through the app pool, long after /health goes
 * green. While that runs the server is effectively unavailable - navigations time out and the
 * browser phase fails for reasons that have nothing to do with the app. index.ts logs a
 * definitive marker when it is done, so wait for that rather than guessing.
 *
 * Returns { done, succeeded, failed }, counts taken from the seeder summary line.
 * "Seed complete: N succeeded, M failed" line.
 */
async function waitForSeedComplete(getLog, budgetMs = 300000) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const logText = getLog();
    if (/fixDemoPasswords completed successfully|Demo data fix failed/i.test(logText)) {
      const m = logText.match(/Seed complete: (\d+) succeeded, (\d+) failed/);
      return { done: true, succeeded: m ? Number(m[1]) : null, failed: m ? Number(m[2]) : null };
    }
    await sleep(1000);
  }
  return { done: false, succeeded: null, failed: null };
}
/**
 * Waits until the server is not just UP but IDLE.
 *
 * Health can go green long before startup work has finished. Demo seeding in particular keeps
 * running in the background, saturating the DB and the event loop - requests then queue for
 * tens of seconds and Playwright reports navigation timeouts that look like app bugs. Requiring
 * several consecutive FAST health responses waits that storm out without needing to know
 * anything about what the server is busy with.
 */
async function waitForServerQuiet(port, { needed = 3, fastMs = 1500, budgetMs = 240000 } = {}) {
  const deadline = Date.now() + budgetMs;
  let streak = 0;
  while (Date.now() < deadline) {
    const t0 = Date.now();
    let good = false;
    try {
      const ctl = AbortSignal.timeout(fastMs);
      const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: ctl });
      good = r.status === 200 && (Date.now() - t0) < fastMs;
    } catch { good = false; }
    streak = good ? streak + 1 : 0;
    if (streak >= needed) return true;
    await sleep(1000);
  }
  return false;
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
    log(`${RED}✗ backend/dist not built - run \`npm run build\` in backend/ first.${RESET}\n`);
    process.exit(1);
  }
  // A stale build verifies the PREVIOUS code, not the change in front of you (2026-11-18: a new search
  // clause "failed" because dist was one push old). Refuse to run against a build older than the source.
  {
    const newest = (dir) => {
      let latest = 0;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        latest = Math.max(latest, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
      }
      return latest;
    };
    const srcTime = newest(path.join(BACKEND, 'src'));
    const distTime = fs.statSync(distEntry).mtimeMs;
    if (srcTime > distTime + 1000) {
      log(`${RED}✗ backend/dist is older than backend/src - it would verify the previous code.${RESET}`);
      log(`  Run \`npm run build\` in backend/ first, then verify again.\n`);
      process.exit(1);
    }
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
    step(`Starting throwaway PostgreSQL ${DIM}(${PGBIN})${RESET}`);
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
      fail('init.sql failed - a fresh deploy would end up with NO schema at all (atomic apply).',
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
    let serverHealthy = false;
    let serverLog = '';
    if (!failed) {
      step('PHASE 3  Schema snapshot (before the server has ever connected)');
      baseline = snapshot('verifydb');
      ok(`${baseline.constraints.length} constraints, ${baseline.columns.length} columns`);

      step('PHASE 4  Booting the real compiled server');
      port = await freePort();
      serverProc = spawn(process.execPath, [distEntry], {
        cwd: BACKEND,
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Individual params, NOT DATABASE_URL: config forces SSL whenever DATABASE_URL is
          // set, and a local cluster rejects SSL.
          GROQ_API_KEY: '', OPENAI_API_KEY: '', // never call a real AI provider from a verification run
          DATABASE_URL: '', DB_HOST: '127.0.0.1', DB_PORT: String(PG_PORT),
          DB_USER: 'postgres', DB_PASSWORD: '', DB_NAME: 'verifydb', DB_SCHEMA: SCHEMA,
          MOCK_DB: 'false', MOCK_REDIS: 'true',
                    // Seeding is ON for every run, not just --full: SEED_ON_STARTUP=true is set on BOTH
          // live environments (vetcare-dev and vetcare-demo), so a broken demo seed breaks them
          // both - and the gate used to run with it off, which meant it could never have caught
          // that. PHASE 6b below asserts the seeded demo accounts can actually log in.
          SEED_ON_STARTUP: 'true', FORCE_RESEED: 'false',
          // Never let a verification run touch a real provider - a unit test once sent a REAL
          // email through the developer's Gmail (2026-07-10). Blanking these forces log-only.
          RESEND_API_KEY: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
          FEATURE_EMAIL_NOTIFICATIONS: 'false',
          ENABLE_SELF_PING: 'false',
          // Pass through so the gate can be run BOTH ways:
          //   normal        → proves production behaviour (self-heal on) still works
          //   =true         → proves init.sql + migrations alone are sufficient, which is the
          //                   evidence needed before the self-heal can actually be deleted
          DISABLE_LEGACY_SELFHEAL: process.env.DISABLE_LEGACY_SELFHEAL || '',
          // The gate legitimately authenticates far more than a human would from one IP:
          // every role registers, every seeded demo account logs in, then Playwright does it
          // all again through the UI. The production default (15 per 15 min) would 429 midway
          // and surface as phantom failures. Defaults in app.ts are untouched - this is an
          // opt-in override for the verification run only.
          AUTH_RATE_LIMIT_MAX: '100000', AUTH_RATE_LIMIT_WINDOW_MS: '60000',
          // Same reason, for the whole-app sweep that opens every screen of every role.
          API_RATE_LIMIT_MAX: '1000000', SENSITIVE_RATE_LIMIT_MAX: '1000000',
          PORT: String(port), NODE_ENV: 'development',
        },
      });
      serverProc.stdout.on('data', d => { serverLog += d.toString(); });
      serverProc.stderr.on('data', d => { serverLog += d.toString(); });
      serverProc.on('error', e => { serverLog += `\nSPAWN ERROR: ${e.message}\n`; });
      serverProc.on('exit', (code, sig) => { serverLog += `\nSERVER EXITED early (code=${code} signal=${sig})\n`; });

      let healthy = false;
      let lastHealthErr = '';
      for (let i = 0; i < 90; i++) {
        try {
          const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          if (r.status === 200) { healthy = true; serverHealthy = true; break; }
          lastHealthErr = `health returned HTTP ${r.status}`;
        } catch (e) { lastHealthErr = e.message; }
        await sleep(1000);
      }
      if (!healthy) {
        const detail = serverLog.split('\n').filter(Boolean).slice(-25);
        detail.push(`last health probe: ${lastHealthErr}`);
        if (serverLog.trim() === '') detail.push('(server produced NO output at all)');
        fail('Server never became healthy against a real database.', detail);
      } else {
        ok();

        // ── PHASE 4b: the demo seed ──
        // Seeding keeps running long after /health goes green, and every later phase races it
        // unless we wait for the marker index.ts logs when it finishes.
        step('PHASE 4b Demo seed applied cleanly');
        const seed = await waitForSeedComplete(() => serverLog);
        if (!seed.done) {
          fail('Demo seed never finished within 5 minutes.',
            ['SEED_ON_STARTUP=true is set on vetcare-dev and vetcare-demo, so this runs on every',
             'boot there too. A seed that never completes leaves those environments half-populated.']);
        } else if (seed.failed) {
          const bad = serverLog.split('\n')
            .filter(l => /Seed: ⚠/.test(l))
            // Capture up to the winston metadata blob, NOT [^"]+ - Postgres messages contain quoted
            // identifiers (relation "bookings"), so that pattern cut every error at the first quote
            // and hid the constraint name that identifies the problem.
            .map(l => (l.match(/Seed: ⚠ (.+?)(?= {"service")/) || [, l])[1].trim());
          fail(`Demo seed applied with ${seed.failed} failed section(s) (${seed.succeeded} succeeded).`,
            [...new Set(bad)].slice(0, 15).concat([
              '',
              'These sections are silently skipped on vetcare-dev and vetcare-demo too, so those',
              'environments are running with incomplete demo data. Fix docker/seed-demo-data.sql.']));
        } else {
          ok(`${seed.succeeded} sections`);
        }

        // Even after the seed reports done, give the event loop a moment to drain before the
        // browser phase drives it.
        const quiet = await waitForServerQuiet(port);
        if (!quiet) {
          fail('Server never became idle after startup.',
            ['Health stayed slow for 4 minutes - something is still saturating it.',
             'Later phases would race it and fail misleadingly.']);
        }

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
          lines.push('Look in backend/src/utils/database/ (ensureSchemaPublic.ts, ensurePaymentModuleSchema.ts, seed/phase*.ts):');
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
    if (serverHealthy && port) {
      const roles = registerableRoles();
      step(`PHASE 6  Registering all ${roles.length} self-registerable role(s)`);
      const problems = [];
      const base = `http://127.0.0.1:${port}/api/v1`;

      // A mobile number is a login identifier now: unique per account, and a real Indian mobile (starts 6-9).
      let mobileSeq = Math.floor(Date.now() / 1000) % 100000000;
      const uniqueMobile = () => `9${String(mobileSeq++).padStart(9, '0')}`;
      for (const role of roles) {
        // Fixtures must satisfy the real Joi rules: a resolvable-looking TLD, and names
        // restricted to /^[a-zA-Z\s'-]+$/ (so no underscores from the role slug).
        const safeName = role.replace(/_/g, ' ');
        const email = `verify.${role.replace(/_/g, '.')}.${Date.now()}@example.com`;
        const body = {
          firstName: 'Verify', lastName: safeName, email, phone: uniqueMobile(),
          password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true,
        };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-1';

        const reg = await http('POST', `${base}/auth/register`, body);
        if (reg.status >= 400 || !reg.json?.success) {
          const detail = reg.json?.error?.details?.originalError || reg.json?.message || `HTTP ${reg.status}`;
          problems.push(`role '${role}' cannot register: ${detail}`);
          continue;
        }
        // Roles needing admin approval get no token - that is correct, not a failure.
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
          problems.push(`role '${role}' resolves to ZERO permissions - it would see an empty app`);
        }
      }

      if (problems.length) {
        fail(`${problems.length} role(s) are broken end-to-end.`, problems);
      } else {
        ok(roles.join(', '));
      }
    }

    // ── PHASE 6b: the seeded demo accounts ──
    // vetcare-dev and vetcare-demo both run SEED_ON_STARTUP=true, so the demo dataset IS a
    // production code path for them. A seed that fails to apply, or password hashes that never
    // get fixed up, locks every demo account out - and no static check can see it. Credentials
    // are read from frontend/e2e/constants.ts so this stays in step with the e2e suite that
    // depends on exactly these accounts.
    if (serverHealthy && port) {
      step('PHASE 6b Seeded demo accounts can log in');
      const base = `http://127.0.0.1:${port}/api/v1`;
      let seeded = [];
      try {
        const src = fs.readFileSync(
          path.join(ROOT, 'frontend', 'e2e', 'constants.ts'), 'utf8');
        const block = src.slice(src.indexOf('export const USERS'), src.indexOf('} as const'));
        seeded = [...block.matchAll(/email:\s*'([^']+)',\s*password:\s*'([^']+)'/g)]
          .map(m => ({ email: m[1], password: m[2] }));
      } catch (e) {
        seeded = [];
      }

      if (seeded.length === 0) {
        fail('Could not read demo credentials from frontend/e2e/constants.ts.',
          ['If USERS was refactored, update PHASE 6b so seed verification keeps working.']);
      } else {
        const broken = [];
        for (const u of seeded) {
          const r = await http('POST', `${base}/auth/login`, { email: u.email, password: u.password });
          if (r.status !== 200 || !r.json?.data?.token) {
            broken.push(`${u.email}: HTTP ${r.status} ${r.json?.message || r.json?.error?.message || ''}`.trim());
          }
        }
        if (broken.length) {
          fail(`${broken.length}/${seeded.length} seeded demo account(s) cannot log in.`,
            [...broken, '', 'The demo seed is a live code path - SEED_ON_STARTUP=true on both',
              'vetcare-dev and vetcare-demo. These accounts are also what the e2e suite uses.']);
        } else {
          ok(`${seeded.length} accounts`);
        }
      }
    }

    // ── PHASE 6c: the AI assistant can read the user's own data ──
    // buildUserContext() swallowed its own SQL errors, so a wrong column name left the assistant
    // knowing NOTHING about the user's animals while every static check and every screen stayed green
    // (2026-11-17). A seeded farmer with animals asks about one; the server must build the context.
    if (serverHealthy && port) {
      step('PHASE 6c AI assistant builds a farmer\'s context');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const login = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
      const token = login.json?.data?.token;
      if (!token) {
        fail('Could not sign in as the seeded demo farmer to test the AI assistant.', [`HTTP ${login.status}`]);
      } else {
        const sess = await http('POST', `${apiBase}/ai-copilot/sessions`, { title: 'verify' }, token);
        const sessionId = sess.json?.data?.id || sess.json?.data?.session?.id;
        const sent = sessionId
          ? await http('POST', `${apiBase}/ai-copilot/sessions/${sessionId}/messages`, { content: 'How is Bessie doing in health?' }, token)
          : sess;
        const newLog = serverLog.slice(mark);
        const ctxFail = newLog.split('\n').filter(l => /Failed to build user context for AI/.test(l)).map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-200));
        if (!sessionId || sent.status >= 400) {
          fail('The AI assistant did not answer a seeded farmer.', [`session: HTTP ${sess.status}`, `message: HTTP ${sent.status} ${JSON.stringify(sent.json || {}).slice(0, 200)}`]);
        } else if (ctxFail.length) {
          fail('The AI assistant could not build the user\'s context (it would answer knowing nothing about their animals).', ctxFail);
        } else {
          ok('context built from the real schema');
        }
      }
    }

    // ── PHASE 6d: the marketplace, end to end on the real schema ──
    // The marketplace builds its SQL from many optional filters (place, age, search in any script, distance)
    // and from a privacy rule (a stranger gets a ~1 km pin and a masked phone, never the exact spot or the
    // number). Unit tests mock the database, so only a real query proves the SQL is valid and the rule holds.
    if (serverHealthy && port) {
      step('PHASE 6d Marketplace filters, search, privacy and contact reveal');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      const seller = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
      const buyer = await http('POST', `${apiBase}/auth/login`, { email: 'maria.garcia@sunrisefarm.com', password: 'Demo@123' });
      const sTok = seller.json?.data?.token;
      const bTok = buyer.json?.data?.token;
      if (!sTok || !bTok) {
        problems.push(`could not sign in the two seeded farmers (seller HTTP ${seller.status}, buyer HTTP ${buyer.status})`);
      } else {
        const unique = `VerifyBreed${Date.now()}`;
        // category 'feed' goes live without the moderation queue that animal listings wait in
        const created = await http('POST', `${apiBase}/marketplace/listings`, {
          title: `${unique} test listing`, description: 'runtime verification', category: 'feed', listingType: 'fixed_price', price: 1234,
          quantity: 1, unit: 'kg', species: 'cattle', breed: unique, animalAgeMonths: 24, contactPhone: '9876543210',
          state: 'Kerala', district: 'Thrissur', pincode: '680001', latitude: 10.523456, longitude: 76.214567,
        }, sTok);
        const listingId = created.json?.data?.id || created.json?.data?.listing?.id;
        if (created.status >= 300 || !listingId) {
          problems.push(`create listing: HTTP ${created.status} ${JSON.stringify(created.json || {}).slice(0, 200)}`);
        } else {
          const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
          const allFilters = { search: unique, searchAliases: `${unique}|cattle`, state: 'Kerala', district: 'Thrissur', pincode: '680001',
            minAge: '12', maxAge: '36', minPrice: '1', maxPrice: '100000', userLat: '10.5', userLng: '76.2', radiusKm: '100', sortBy: 'distance' };
          const authed = await http('GET', `${apiBase}/marketplace/listings?${q(allFilters)}`, null, bTok);
          const pub = await http('GET', `${apiBase}/public/marketplace/listings?${q(allFilters)}`);
          for (const [name, r] of [['signed-in list', authed], ['public list', pub]]) {
            if (r.status !== 200) problems.push(`${name} with every filter: HTTP ${r.status} ${JSON.stringify(r.json || {}).slice(0, 200)}`);
          }
          const found = (authed.json?.data?.items || []).find(l => l.id === listingId);
          if (!found) {
            // Say what the listing actually looks like, so a failure is diagnosable from the log alone
            const one = await http('GET', `${apiBase}/marketplace/listings/${listingId}`, null, bTok);
            const d = one.json?.data || {};
            problems.push('the new listing was not found by search + state + district + pincode + age + distance (signed-in). '
              + `It reads back as: status=${d.status} approved=${d.admin_approved} breed=${d.breed} state=${d.state} district=${d.district} pincode=${d.pincode} age=${d.animal_age_months} price=${d.price} (HTTP ${one.status}); `
              + `the list returned ${(authed.json?.data?.items || []).length} item(s), total=${authed.json?.data?.total}`);
          }
          else {
            if ('latitude' in found || 'longitude' in found) problems.push('a stranger received the seller\'s EXACT latitude/longitude');
            if (found.map_lat === undefined || found.map_lng === undefined) problems.push('no rounded map pin (map_lat/map_lng) for a listing that has coordinates');
            if (found.contact_phone) problems.push('a stranger received the seller\'s full phone number in the list');
            if (!found.contact_phone_masked) problems.push('no masked phone in the list');
            if (found.distance_km === undefined || found.distance_km === null) problems.push('no distance_km although the buyer shared a position');
          }
          const pubFound = (pub.json?.data?.items || []).find(l => l.id === listingId);
          if (!pubFound) problems.push('the new listing was not found on the public list');
          else if ('latitude' in pubFound || 'contact_phone' in pubFound) problems.push('the public list exposes exact coordinates or a phone number');
          // a search that only matches through the alias list (the typed words match nothing in the text)
          const viaAlias = await http('GET', `${apiBase}/marketplace/listings?${q({ search: 'zzzznomatchzzzz', searchAliases: unique.toLowerCase() })}`, null, bTok);
          if (!(viaAlias.json?.data?.items || []).some(l => l.id === listingId)) {
            problems.push(`a search that matches only through searchAliases did not find the listing (HTTP ${viaAlias.status}, ${(viaAlias.json?.data?.items || []).length} item(s), total=${viaAlias.json?.data?.total}, ${JSON.stringify(viaAlias.json?.error || {}).slice(0, 200)})`);
          }

          const rev = await http('POST', `${apiBase}/marketplace/listings/${listingId}/reveal-contact`, { channel: 'call' }, bTok);
          if (rev.status !== 200 || rev.json?.data?.phone !== '9876543210') problems.push(`reveal-contact: HTTP ${rev.status} ${JSON.stringify(rev.json || {}).slice(0, 160)}`);
          const views = await http('GET', `${apiBase}/marketplace/listings/${listingId}/contact-views`, null, sTok);
          if (views.status !== 200 || (views.json?.data?.items || []).length !== 1) problems.push(`the seller's who-viewed list: HTTP ${views.status} ${JSON.stringify(views.json || {}).slice(0, 160)}`);
          const strangerViews = await http('GET', `${apiBase}/marketplace/listings/${listingId}/contact-views`, null, bTok);
          if (strangerViews.status !== 403) problems.push(`a non-seller could read the who-viewed list (HTTP ${strangerViews.status})`);
          const gone = await http('POST', `${apiBase}/marketplace/listings/00000000-0000-4000-8000-000000000000/reveal-contact`, { channel: 'call' }, bTok);
          if (gone.status !== 404 || !gone.json?.error?.message) problems.push(`reveal on a missing listing should be a plain 404 message, got HTTP ${gone.status}`);
          // my listings: the seller sees their own, including the exact spot
          const mine = await http('GET', `${apiBase}/marketplace/listings?sellerId=${seller.json?.data?.user?.id || ''}&status=&limit=100`, null, sTok);
          if (mine.status !== 200) problems.push(`the seller's own listing list: HTTP ${mine.status}`);
          await http('DELETE', `${apiBase}/marketplace/listings/${listingId}`, null, sTok);
        }
      }
      const sqlErrs = serverLog.slice(mark).split('\n').filter(l => /error|ERROR/.test(l) && /marketplace|syntax|column|relation|parameter/i.test(l)).map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-200));
      if (problems.length || sqlErrs.length) fail('The marketplace misbehaves on the real schema.', [...problems, ...sqlErrs]);
      else ok('filters, search aliases, privacy and reveal verified');
    }

    // ── PHASE 6e: animal nutrition, every write path on the real schema (docs/NUTRITION_PLAN.md, migration 056) ──
    // Unit tests mock the database; only real queries prove the SQL (partial unique indexes, ON CONFLICT on an
    // expression index, write-through to animals / weight_history) and the access rule. A fresh pet owner adds a
    // dog, answers the missing facts, weighs and scores it, builds and saves a plan, logs a meal and an unsafe
    // treat; a stranger and an unbooked vet are refused in words.
    if (serverHealthy && port) {
      step('PHASE 6e Nutrition: facts, body history, plan, feeding, safety and access');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      try {
        psql('verifydb', `SET search_path TO ${SCHEMA}, public;
          INSERT INTO system_settings (key, value, description) VALUES ('nutrition.enabled', 'true', 'enabled by runtime-verify PHASE 6e')
          ON CONFLICT (key) DO UPDATE SET value = 'true';`);
      } catch { problems.push('could not switch nutrition.enabled on in the verification database'); }
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 7000;
      const signUp = async (role) => {
        const email = `verify.nutri.${role}.${Date.now()}.${seq}@example.com`;
        const body = { firstName: 'Nutri', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`,
          password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-2';
        await http('POST', `${apiBase}/auth/register`, body);
        if (role === 'veterinarian') {
          psql('verifydb', `SET search_path TO ${SCHEMA}, public; UPDATE users SET account_status = 'active', is_active = true WHERE email = '${email}';`);
        }
        const login = await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' });
        return login.json?.data?.token;
      };
      const owner = await signUp('pet_owner');
      const stranger = await signUp('pet_owner');
      const vet = await signUp('veterinarian');
      if (!owner || !stranger || !vet) {
        problems.push('could not create the owner / stranger / vet accounts for the nutrition check');
      } else {
        const created = await http('POST', `${apiBase}/animals`, { name: 'Verify Bruno', species: 'Dog', gender: 'male' }, owner);
        const animalId = created.json?.data?.id;
        if (!animalId) problems.push(`create dog: HTTP ${created.status} ${JSON.stringify(created.json || {}).slice(0, 200)}`);
        else {
          const ov1 = await http('GET', `${apiBase}/nutrition/animals/${animalId}`, null, owner);
          const missing = (ov1.json?.data?.missingFacts || []).map(m => m.key);
          if (ov1.status !== 200) problems.push(`overview: HTTP ${ov1.status} ${JSON.stringify(ov1.json || {}).slice(0, 200)}`);
          else if (!missing.includes('weight') || !missing.includes('dateOfBirth')) problems.push(`missing facts should ask for weight and date of birth, got [${missing}]`);
          if (ov1.json?.data?.model !== 'companion_energy') problems.push(`a dog should use companion_energy, got ${ov1.json?.data?.model}`);

          const facts = await http('PATCH', `${apiBase}/nutrition/animals/${animalId}/facts`, { dateOfBirth: '2021-03-01', isNeutered: true, activityLevel: 'moderate', housing: 'indoor' }, owner);
          if (facts.status !== 200) problems.push(`save facts: HTTP ${facts.status} ${JSON.stringify(facts.json || {}).slice(0, 200)}`);
          const animal = await http('GET', `${apiBase}/animals/${animalId}`, null, owner);
          const a = animal.json?.data || {};
          if (a.activityLevel !== 'moderate' || a.housing !== 'indoor') problems.push(`facts were not written through to the animal profile (activityLevel=${a.activityLevel}, housing=${a.housing})`);

          const m = await http('POST', `${apiBase}/nutrition/animals/${animalId}/measurements`, { weight: 24, unit: 'kg', bodyConditionScore: 7, bcsScale: 9 }, owner);
          if (m.status !== 201) problems.push(`add measurement: HTTP ${m.status} ${JSON.stringify(m.json || {}).slice(0, 200)}`);
          const wh = await http('GET', `${apiBase}/weight-history/animal/${animalId}`, null, owner);
          if (!(wh.json?.data || []).some(w => Number(w.weight) === 24)) problems.push('the nutrition weight is not in the medical weight history (single source of truth broken)');
          const bcsOnly = await http('POST', `${apiBase}/nutrition/animals/${animalId}/measurements`, { bodyConditionScore: 7, bcsScale: 9 }, owner);
          if (bcsOnly.status !== 201) problems.push(`a condition score without a weight: HTTP ${bcsOnly.status}`);
          const wh2 = await http('GET', `${apiBase}/weight-history/animal/${animalId}`, null, owner);
          if ((wh2.json?.data || []).some(w => w.weight === null)) problems.push('the weight history list shows a condition-only row with an empty weight');

          const foods = await http('GET', `${apiBase}/nutrition/foods?animalId=${animalId}&search=rice`, null, owner);
          const rice = (foods.json?.data?.items || []).find(f => f.code === 'home_rice_cooked');
          if (!rice) problems.push(`the seeded food library is not readable (HTTP ${foods.status})`);
          const plan = { goal: 'lose', mealsPerDay: 2, foods: [
            ...(rice ? [{ ingredientId: rice.id, sharePct: 30 }] : []),
            { label: 'Verify kibble', kcalPer100g: 350, sharePct: 70 },
          ] };
          const pre = await http('POST', `${apiBase}/nutrition/animals/${animalId}/plan/preview`, plan, owner);
          const kcal = pre.json?.data?.energy?.dailyKcal;
          // 24 kg at condition 7/9 -> ideal 20 kg; weight loss = 1.0 x 70 x 20^0.75 = 662 kcal
          if (pre.status !== 200 || kcal !== 662) problems.push(`plan preview: HTTP ${pre.status}, expected 662 kcal, got ${kcal} ${JSON.stringify(pre.json?.error || {}).slice(0, 160)}`);
          const saved = await http('POST', `${apiBase}/nutrition/animals/${animalId}/plan`, plan, owner);
          const planId = saved.json?.data?.id;
          if (saved.status !== 201 || !planId) problems.push(`save plan: HTTP ${saved.status} ${JSON.stringify(saved.json || {}).slice(0, 200)}`);
          const again = await http('POST', `${apiBase}/nutrition/animals/${animalId}/plan`, plan, owner);
          if (again.status !== 201) problems.push(`replacing the plan: HTTP ${again.status} (the old one must be superseded, not conflict)`);
          const unsafePlan = await http('POST', `${apiBase}/nutrition/animals/${animalId}/plan`, { foods: [{ label: 'Chocolate biscuits', kcalPer100g: 480, sharePct: 100 }] }, owner);
          if (unsafePlan.status !== 400 || !/unsafe/i.test(unsafePlan.json?.message || unsafePlan.json?.error?.message || '')) problems.push(`a plan with chocolate for a dog was not refused in words (HTTP ${unsafePlan.status})`);

          const ov2 = await http('GET', `${apiBase}/nutrition/animals/${animalId}`, null, owner);
          const item = ov2.json?.data?.plan?.items?.[0];
          if (!item) problems.push('the saved plan has no items in the overview');
          else {
            const fed = await http('POST', `${apiBase}/nutrition/animals/${animalId}/feeding`, { planItemId: item.id, kind: 'meal', amountG: item.gramsPerMeal }, owner);
            if (fed.status !== 201) problems.push(`log meal: HTTP ${fed.status} ${JSON.stringify(fed.json || {}).slice(0, 200)}`);
          }
          const treat = await http('POST', `${apiBase}/nutrition/animals/${animalId}/feeding`, { label: 'piece of dark chocolate', kind: 'treat', amountG: 10, kcal: 55 }, owner);
          if (treat.status !== 201 || !(treat.json?.data?.warnings || []).length) problems.push(`an unsafe treat was not flagged (HTTP ${treat.status})`);
          const ov3 = await http('GET', `${apiBase}/nutrition/animals/${animalId}`, null, owner);
          const types = (ov3.json?.data?.flags || []).map(f => f.type);
          for (const want of ['unsafe_food_logged', 'bcs_high']) if (!types.includes(want)) problems.push(`expected an open '${want}' alert, got [${types}]`);

          const strangerRead = await http('GET', `${apiBase}/nutrition/animals/${animalId}`, null, stranger);
          if (strangerRead.status !== 403 || !(strangerRead.json?.message || strangerRead.json?.error?.message)) problems.push(`a stranger read another owner's animal nutrition (HTTP ${strangerRead.status})`);
          const strangerWrite = await http('POST', `${apiBase}/nutrition/animals/${animalId}/measurements`, { weight: 1 }, stranger);
          if (strangerWrite.status !== 403) problems.push(`a stranger wrote a weight for another owner's animal (HTTP ${strangerWrite.status})`);
          const vetRead = await http('GET', `${apiBase}/nutrition/animals/${animalId}`, null, vet);
          if (vetRead.status !== 403) problems.push(`a vet with no appointment read the animal's nutrition (HTTP ${vetRead.status})`);
          if (planId) {
            const ownerReview = await http('POST', `${apiBase}/nutrition/plans/${planId}/review`, { note: 'x' }, owner);
            if (ownerReview.status !== 403 && ownerReview.status !== 400) problems.push(`a pet owner could review a plan as a vet (HTTP ${ownerReview.status})`);
          }
          const list = await http('GET', `${apiBase}/nutrition/animals?filter=attention`, null, owner);
          if (!(list.json?.data?.items || []).some(x => x.id === animalId)) problems.push(`the animal with open alerts is missing from the "needs attention" list (HTTP ${list.status})`);
          // Farm ration (Phase 2, migration 057): a 400 kg cow giving 10 L, balanced from the seeded feed library.
          const cow = await http('POST', `${apiBase}/animals`, { name: 'Verify Lakshmi', species: 'Cattle', gender: 'female' }, owner);
          const cowId = cow.json?.data?.id;
          if (!cowId) problems.push(`create cow: HTTP ${cow.status} ${JSON.stringify(cow.json || {}).slice(0, 160)}`);
          else {
            await http('POST', `${apiBase}/nutrition/animals/${cowId}/measurements`, { weight: 400, unit: 'kg' }, owner);
            const feedList = await http('GET', `${apiBase}/nutrition/foods?animalId=${cowId}`, null, owner);
            const byCode = Object.fromEntries((feedList.json?.data?.items || []).map(f => [f.code, f.id]));
            const wanted = ['feed_green_maize', 'feed_wheat_straw', 'feed_cattle_feed', 'feed_groundnut_cake', 'feed_mineral_mixture'];
            const missingFeeds = wanted.filter(c => !byCode[c]);
            if (missingFeeds.length) problems.push(`the seeded feed library is missing ${missingFeeds.join(', ')} for a cow`);
            else {
              const ration = { milkLitresPerDay: 10, feeds: [
                { ingredientId: byCode.feed_green_maize, pricePerKg: 2 }, { ingredientId: byCode.feed_wheat_straw, pricePerKg: 6 },
                { ingredientId: byCode.feed_cattle_feed, pricePerKg: 25 }, { ingredientId: byCode.feed_groundnut_cake, pricePerKg: 45 },
                { ingredientId: byCode.feed_mineral_mixture, pricePerKg: 80 },
              ] };
              const rp = await http('POST', `${apiBase}/nutrition/animals/${cowId}/ration/preview`, ration, owner);
              const rr = rp.json?.data?.result;
              if (rp.status !== 200 || rr?.status !== 'ok' || !(rr.costPerLitre > 0)) problems.push(`ration preview: HTTP ${rp.status} ${JSON.stringify(rp.json?.data?.result?.reasons || rp.json?.error || {}).slice(0, 200)}`);
              const rs = await http('POST', `${apiBase}/nutrition/animals/${cowId}/ration`, ration, owner);
              if (rs.status !== 201 || rs.json?.data?.model !== 'ruminant_dm' || !(rs.json?.data?.items || []).length) problems.push(`save ration: HTTP ${rs.status} ${JSON.stringify(rs.json || {}).slice(0, 200)}`);
              const cowNow = await http('GET', `${apiBase}/animals/${cowId}`, null, owner);
              if (Number(cowNow.json?.data?.avgDailyMilkLitres) !== 10) problems.push(`the milk yield typed in the ration was not saved on the animal profile (got ${cowNow.json?.data?.avgDailyMilkLitres})`);
              const strawOnly = await http('POST', `${apiBase}/nutrition/animals/${cowId}/ration/preview`, { milkLitresPerDay: 15, feeds: [{ ingredientId: byCode.feed_wheat_straw, pricePerKg: 6 }] }, owner);
              if (strawOnly.json?.data?.result?.status !== 'infeasible') problems.push('a straw-only ration for a 15 L cow was not reported as impossible');
            }
          }
          // The admin's list (all animals) binds the same parameters as everyone else's - it once did not.
          const admin = await http('POST', `${apiBase}/auth/login`, { email: 'admin@vetcare.com', password: 'Admin@123' });
          const aTok = admin.json?.data?.token;
          if (aTok) {
            for (const f of ['', 'attention', 'no_plan']) {
              const al = await http('GET', `${apiBase}/nutrition/animals?limit=5${f ? `&filter=${f}` : ''}`, null, aTok);
              if (al.status !== 200) problems.push(`the admin's nutrition list${f ? ` (${f})` : ''}: HTTP ${al.status}`);
            }
          } else problems.push('could not sign in as the seeded admin to check the admin nutrition list');
        }
      }
      // Only real SQL / database errors: the deliberate refusals above (400 / 403) are logged by the server too.
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (problems.length || sqlErrs.length) fail('Nutrition misbehaves on the real schema.', [...problems, ...sqlErrs]);
      else ok('write-through, body history, plan maths, safety alerts and access rules verified');
    }

    // ── PHASE 7: the browser ──
    let sweepAccounts = [];
    if (serverHealthy && port) {
      const FRONTEND = path.join(ROOT, 'frontend');
      const distIndex = path.join(FRONTEND, 'dist', 'index.html');

      if (!fs.existsSync(distIndex)) {
        step('PHASE 7  Browser journeys');
        fail('frontend/dist is missing - the server has no SPA to serve.',
          ['Run `npm run build` in frontend/ first (the pre-deploy gate does this as check #2).']);
      } else {
        // The grooming module is dark-launched; switch it on so the browser pass covers the
        // flag-on UI (the groomer role option, the grooming nav section) rather than silently
        // testing a smaller app than production runs.
        try {
          psql('verifydb', `SET search_path TO ${SCHEMA}, public;
            INSERT INTO system_settings (key, value, description)
            VALUES ('grooming.enabled', 'true', 'enabled by runtime-verify PHASE 7')
            ON CONFLICT (key) DO UPDATE SET value = 'true';`);
          // Same for the farm daily-records module: the sweep must see the flag-on screens.
          psql('verifydb', `SET search_path TO ${SCHEMA}, public;
            INSERT INTO system_settings (key, value, description)
            VALUES ('farm.records.enabled', 'true', 'enabled by runtime-verify PHASE 7')
            ON CONFLICT (key) DO UPDATE SET value = 'true';`);
          // And animal nutrition (docs/NUTRITION_PLAN.md): the sweep opens /nutrition and /admin/nutrition flag-on.
          psql('verifydb', `SET search_path TO ${SCHEMA}, public;
            INSERT INTO system_settings (key, value, description)
            VALUES ('nutrition.enabled', 'true', 'enabled by runtime-verify PHASE 7')
            ON CONFLICT (key) DO UPDATE SET value = 'true';`);
        } catch { /* settings table shape differs - the browser pass still runs without it */ }

        // The whole-app sweep (frontend/e2e/app-sweep.spec.ts) signs in as every role. Farmer and
        // pet owner it registers itself; roles that need approval or cannot self-register are
        // prepared here, where the database can be reached, and handed over as SWEEP_ACCOUNTS.
        sweepAccounts = [];
        try {
          const apiBase = `http://127.0.0.1:${port}/api/v1`;
          const stamp = Date.now();
          let seq = (Math.floor(stamp / 1000) % 100000000) + 5000;
          for (const role of ['veterinarian', 'corporate_admin', 'admin']) {
            const email = `sweep.${role.replace(/_/g, '.')}.${stamp}@example.com`;
            const body = {
              firstName: 'Sweep', lastName: role.replace(/_/g, ' '), email, phone: `9${String(seq++).padStart(9, '0')}`,
              password: 'Password1', confirmPassword: 'Password1', role: role === 'admin' ? 'pet_owner' : role, acceptTerms: true,
            };
            if (role === 'veterinarian') body.licenseNumber = 'SWEEP-LIC-1';
            const reg = await http('POST', `${apiBase}/auth/register`, body);
            if (!reg.json?.success) continue; // the sweep skips a role it has no account for, and says so
            const sql = [`UPDATE users SET account_status = 'active', is_active = true WHERE email = '${email}';`];
            if (role === 'admin') {
              sql.push(`UPDATE users SET role = 'admin' WHERE email = '${email}';`);
              sql.push(`DELETE FROM user_roles WHERE user_id = (SELECT id FROM users WHERE email = '${email}');`);
              sql.push(`INSERT INTO user_roles (user_id, role, is_primary) SELECT id, 'admin', true FROM users WHERE email = '${email}';`);
            }
            psql('verifydb', `SET search_path TO ${SCHEMA}, public; ${sql.join(' ')}`);
            sweepAccounts.push({ role, email, password: 'Password1' });
          }
        } catch { /* best effort: the sweep still covers farmer and pet owner */ }

        // VERIFY_E2E_GREP narrows the browser run (e.g. while developing a spec); default is @critical.
        step(`PHASE 7  Browser journeys (${FULL ? 'FULL e2e suite' : 'critical journeys'} vs the real SPA)`);
        try {
          // --retries=0: a gate must be deterministic. Retries would hide a genuinely flaky
          // journey behind a green tick, which is how a check stops being trustworthy.
          // Invoke Playwright's CLI through node directly. `npx` needs a shell on Windows
          // (deprecated + unescaped args) and `npx.cmd` is not reliably spawnable - both fail
          // with EMPTY stdout/stderr, which makes a real test failure look like a mystery.
          const cli = path.join(FRONTEND, 'node_modules', '@playwright', 'test', 'cli.js');
          await runAsync(process.execPath, [cli, 'test', ...(FULL ? [] : ['--grep', process.env.VERIFY_E2E_GREP || '@critical']), '--reporter', 'list', '--retries=0', `--workers=${process.env.VERIFY_E2E_WORKERS || 1}`], {
            cwd: FRONTEND,
            // @critical is a handful of journeys; --full is 462 tests on a single worker and
            // needs far longer. Overridable via VERIFY_E2E_TIMEOUT_MS.
            timeout: Number(process.env.VERIFY_E2E_TIMEOUT_MS) || (FULL ? 3600000 : 1800000),
            env: { ...process.env, E2E_BASE_URL: `http://127.0.0.1:${port}`, CI: '1', SWEEP_ACCOUNTS: JSON.stringify(sweepAccounts) },
          });
          ok('registration, shell render, i18n, password toggle, whole-app sweep');
        } catch (e) {
          const out = `${(e.stdout || '').toString()}\n${(e.stderr || '').toString()}`.trim();
          if (/Executable doesn't exist|playwright install/i.test(out)) {
            fail('Playwright browsers are not installed.',
              ['Install them once with:  cd frontend && npx playwright install chromium']);
          } else {
            const lines = out ? out.split('\n').filter(l => l.trim()).slice(-30)
              : [`(no output captured) ${e.message}`];

            // A browser failure can mean "the app is wrong" OR "the server died underneath it",
            // and those look identical from Playwright's side (navigation timeouts either way).
            // Say which, every time - guessing at this cost several diagnostic cycles.
            let alive = false;
            try {
              const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
              alive = r.status === 200;
            } catch { alive = false; }
            lines.push('');
            lines.push(alive
              ? 'Server was still healthy after the run - this is an app/test failure.'
              : 'SERVER WAS NOT RESPONDING after the run - the failures above are a symptom, not the cause.');
            // Keep the WHOLE server log: the interesting line (a stack trace, an OOM, a fatal)
            // is rarely in the last 20, and DATA_DIR is deleted on teardown.
            try {
              const dump = path.join(os.tmpdir(), 'vetcare-runtime-verify-server.log');
              fs.writeFileSync(dump, serverLog, 'utf8');
              lines.push(`Full server log: ${dump}`);
            } catch { /* best effort */ }
            const fatal = serverLog.split('\n')
              .filter(l => /error|fatal|unhandled|uncaught|heap out of memory|ECONNRESET/i.test(l))
              .slice(-8);
            if (fatal.length) {
              lines.push('Server errors seen:');
              lines.push(...fatal);
            }
            const tail = serverLog.split('\n').filter(Boolean).slice(-8);
            if (tail.length) {
              lines.push('Last server output:');
              lines.push(...tail);
            }
            fail('Browser journeys failed against the real app.', lines);
          }
        }
      }
    }
    // VERIFY_HOLD=1: keep the whole stack alive so a spec can be developed against it by hand
    // instead of paying ~3 minutes of setup per attempt. Release with: touch <tmp>/vetcare-verify-release
    if (process.env.VERIFY_HOLD === '1' && port) {
      const info = path.join(os.tmpdir(), 'vetcare-verify-hold.json');
      const release = path.join(os.tmpdir(), 'vetcare-verify-release');
      try { fs.rmSync(release, { force: true }); } catch { /* none */ }
      fs.writeFileSync(info, JSON.stringify({ port, pgPort: PG_PORT, schema: SCHEMA, sweepAccounts, release }), 'utf8');
      log(`  HOLDING the stack on http://127.0.0.1:${port} - details in ${info}; create ${release} to stop.`);
      const until = Date.now() + 90 * 60_000;
      while (Date.now() < until && !fs.existsSync(release)) await new Promise(r => setTimeout(r, 2000));
    }
    // ── PHASE 8: nothing the app did during the whole run failed in SQL ──
    // Phases 6-7 drive every screen as every role. A query naming a column or table that does not exist
    // is logged by the server and (usually) swallowed or turned into a vague 500, so no assertion above
    // sees it. Read the server's own log: any such error is a defect, whichever screen caused it.
    if (serverHealthy) {
      step('PHASE 8  Server log: no SQL schema errors during the run');
      const clean = l => l.replace(/\x1b\[[0-9;]*m/g, '');
      const SQL_DEFECT = /(column|relation|function|type) "?[\w.\\"()]+"? (of relation "?\w+"? )?does not exist|syntax error at or near|invalid input syntax for type|bind message supplies|operator does not exist|could not determine data type/i;
      const found = new Map();
      for (const raw of serverLog.split('\n')) {
        const l = clean(raw);
        if (!/error|warn/i.test(l.slice(0, 40)) || !SQL_DEFECT.test(l)) continue;
        const msg = (l.match(SQL_DEFECT) || [''])[0];
        const where = (l.match(/"query":"([^"]{0,70})/) || [])[1] || '';
        found.set(`${msg} | ${where}`, (found.get(`${msg} | ${where}`) || 0) + 1);
      }
      if (found.size) {
        fail(`${found.size} SQL schema error(s) were logged by the server during the run.`,
          [...found.entries()].slice(0, 12).map(([k, n]) => `${n}x  ${k}`)
            .concat(['', 'A query names a column/table that does not exist, or binds the wrong parameters.',
              'Find it with the text above; the full log is dumped on a browser failure (see PHASE 7).']));
      } else {
        ok('clean');
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
    log(`${YELLOW}These are real failures against a real database - they WILL happen on deploy.${RESET}\n`);
    process.exit(1);
  }
  log(`${GREEN}━━━ RUNTIME VERIFICATION PASSED ━━━${RESET}\n`);
})();

process.on('exit', stopEverything);
process.on('SIGINT', () => { stopEverything(); process.exit(130); });
