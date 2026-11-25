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
  // Ask postgres to stop ITSELF first: the postmaster then ends its own workers (io_worker,
  // autovacuum, checkpointer...). A bare `taskkill /T` only sees the children that exist at that
  // instant, and on a busy PC it left io_worker processes alive after every run - orphaned, holding
  // memory, and the cause of stray console windows. taskkill stays as the backstop.
  if (DATA_DIR && pgProc && !pgProc.killed) {
    try {
      pgRun('pg_ctl', ['stop', '-D', path.join(DATA_DIR, 'pgdata'), '-m', 'immediate', '-w', '-t', '20'],
        { stdio: 'ignore', timeout: 30000 });
    } catch { /* already stopped, or never fully started */ }
  }
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
        // The real ERROR lines first: the harmless NOTICEs ("trigger ... does not exist, skipping") used to fill all 12 lines.
        (() => {
          const lines = String(e.stderr || e.message).split('\n').filter(Boolean);
          const errs = lines.filter(l => /ERROR|FATAL|LINE \d|DETAIL|HINT/.test(l));
          return (errs.length ? errs : lines).slice(0, 12);
        })());
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
             'Later phases would race it and fail misleadingly.',
             '--- the last server log lines (what it was busy with) ---',
             ...serverLog.split('\n').filter(l => l.trim()).slice(-25).map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 220))]);
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
    // Farm records and nutrition are dark-launched flags the server caches for 60 s. Switch them on BEFORE any phase calls
    // the API, so a probe in an earlier phase cannot leave "off" cached for the journeys that need the modules.
    if (serverHealthy && port) {
      try {
        psql('verifydb', `SET search_path TO ${SCHEMA}, public;
          INSERT INTO system_settings (key, value, description) VALUES ('farm.records.enabled', 'true', 'enabled by runtime-verify before PHASE 6')
          ON CONFLICT (key) DO UPDATE SET value = 'true';
          INSERT INTO system_settings (key, value, description) VALUES ('nutrition.enabled', 'true', 'enabled by runtime-verify before PHASE 6')
          ON CONFLICT (key) DO UPDATE SET value = 'true';`);
      } catch { /* each phase that needs a flag reports it itself */ }
    }

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
          // Group feeding (migration 059): a seeded farmer's own flock/pond answers; a stranger is refused.
          const farmer = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
          const fTok = farmer.json?.data?.token;
          let grp = [];
          try {
            grp = psqlJson('verifydb', `SELECT g.id FROM ${SCHEMA}.animal_groups g JOIN ${SCHEMA}.enterprises e ON e.id = g.enterprise_id
                                         JOIN ${SCHEMA}.users u ON u.id = e.owner_id WHERE u.email = 'tom.wilson@example.com' LIMIT 1`);
          } catch { grp = []; }
          if (fTok && grp[0]?.id) {
            const gf = await http('GET', `${apiBase}/nutrition/groups/${grp[0].id}/feeding?pricePerKg=30`, null, fTok);
            // 'herd_ration': a cattle / buffalo / goat / sheep / horse group hands over to the herd ration (migration 060).
            if (gf.status !== 200 || !['ok', 'no_curve', 'herd_ration'].includes(gf.json?.data?.status)) problems.push(`group feeding for the farmer's own group: HTTP ${gf.status} ${JSON.stringify(gf.json || {}).slice(0, 200)}`);
            const gs = await http('GET', `${apiBase}/nutrition/groups/${grp[0].id}/feeding`, null, stranger);
            if (gs.status !== 403) problems.push(`a stranger read another farm's group feeding (HTTP ${gs.status})`);
          } else problems.push('could not find a seeded farmer group to check group feeding');
          // The admin's list (all animals) binds the same parameters as everyone else's - it once did not.
          const admin = await http('POST', `${apiBase}/auth/login`, { email: 'admin@vetcare.com', password: 'Admin@123' });
          const aTok = admin.json?.data?.token;
          if (aTok) {
            for (const f of ['', 'attention', 'no_plan']) {
              const al = await http('GET', `${apiBase}/nutrition/animals?limit=5${f ? `&filter=${f}` : ''}`, null, aTok);
              if (al.status !== 200) problems.push(`the admin's nutrition list${f ? ` (${f})` : ''}: HTTP ${al.status}`);
            }
          } else problems.push('could not sign in as the seeded admin to check the admin nutrition list');

          // ── Migrations 060-062: horse rations, herd rations, allergy override, prescribed diets, alert outcomes,
          // the AI explanation route. The AI switch is turned OFF here: verification must never call an outside service.
          try {
            psql('verifydb', `SET search_path TO ${SCHEMA}, public;
              INSERT INTO system_settings (key, value, description) VALUES ('nutrition.ai_assist.enabled', 'false', 'off in runtime-verify: no outside AI calls')
              ON CONFLICT (key) DO UPDATE SET value = 'false';`);
          } catch { problems.push('could not switch the AI explanation off for verification'); }

          // Horse (equine_dm): forage-first least-cost ration; the work level typed is saved on the profile.
          const horse = await http('POST', `${apiBase}/animals`, { name: 'Verify Chetak', species: 'Horse', gender: 'male' }, owner);
          const horseId = horse.json?.data?.id;
          if (!horseId) problems.push(`create horse: HTTP ${horse.status} ${JSON.stringify(horse.json || {}).slice(0, 160)}`);
          else {
            await http('POST', `${apiBase}/nutrition/animals/${horseId}/measurements`, { weight: 450, unit: 'kg' }, owner);
            const hf = await http('GET', `${apiBase}/nutrition/foods?animalId=${horseId}`, null, owner);
            const hc = Object.fromEntries((hf.json?.data?.items || []).map(f => [f.code, f.id]));
            const need = ['feed_grass_hay', 'feed_lucerne_hay', 'feed_oats', 'feed_mineral_mixture'];
            if (need.some(c => !hc[c])) problems.push(`the horse feed library is missing ${need.filter(c => !hc[c]).join(', ')}`);
            if (hc.feed_cattle_feed) problems.push('compound cattle feed (may carry urea / ionophores) is offered for a horse');
            if (need.every(c => hc[c])) {
              const hr = { work: 'moderate', feeds: [
                { ingredientId: hc.feed_grass_hay, pricePerKg: 8 }, { ingredientId: hc.feed_lucerne_hay, pricePerKg: 18 },
                { ingredientId: hc.feed_oats, pricePerKg: 30 }, { ingredientId: hc.feed_mineral_mixture, pricePerKg: 80 },
              ] };
              const hp = await http('POST', `${apiBase}/nutrition/animals/${horseId}/ration/preview`, hr, owner);
              const hres = hp.json?.data?.result;
              // 450 kg x 0.0333 x 1.2 (light work) = 17.98 Mcal DE
              if (hp.status !== 200 || hres?.status !== 'ok' || Math.abs((hres?.need?.deMcal || 0) - 17.98) > 0.05) {
                problems.push(`horse ration preview: HTTP ${hp.status} ${JSON.stringify(hres?.reasons || hres?.need || hp.json?.error || {}).slice(0, 200)}`);
              }
              const hs = await http('POST', `${apiBase}/nutrition/animals/${horseId}/ration`, hr, owner);
              if (hs.status !== 201 || hs.json?.data?.model !== 'equine_dm') problems.push(`save horse ration: HTTP ${hs.status} ${JSON.stringify(hs.json || {}).slice(0, 200)}`);
              const hNow = await http('GET', `${apiBase}/animals/${horseId}`, null, owner);
              if (hNow.json?.data?.activityLevel !== 'moderate') problems.push(`the work level typed in the horse ration was not saved on the profile (got ${hNow.json?.data?.activityLevel})`);
              const grainOnly = await http('POST', `${apiBase}/nutrition/animals/${horseId}/ration/preview`, { feeds: [{ ingredientId: hc.feed_oats, pricePerKg: 30 }] }, owner);
              if (!(grainOnly.json?.data?.result?.reasons || []).includes('no_forage')) problems.push('a grain-only horse ration was not refused for lack of forage');
            }
          }

          // Allergy override: a food the medical record says the animal is allergic to is refused in words.
          const allergy = await http('POST', `${apiBase}/allergies`, { animalId, allergen: 'Chicken', severity: 'moderate' }, owner);
          if (allergy.status !== 201 && allergy.status !== 200) problems.push(`add allergy: HTTP ${allergy.status} ${JSON.stringify(allergy.json || {}).slice(0, 160)}`);
          else {
            const chickenFood = (await http('GET', `${apiBase}/nutrition/foods?animalId=${animalId}&search=chicken`, null, owner)).json?.data?.items?.find(f => f.code === 'home_chicken_boiled');
            if (chickenFood) {
              const allergicPlan = await http('POST', `${apiBase}/nutrition/animals/${animalId}/plan`, { foods: [{ ingredientId: chickenFood.id, sharePct: 100 }] }, owner);
              if (allergicPlan.status !== 400 || !/allergic/i.test(allergicPlan.json?.message || allergicPlan.json?.error?.message || '')) {
                problems.push(`a plan with a food the animal is allergic to was not refused in words (HTTP ${allergicPlan.status})`);
              }
            } else problems.push('the seeded chicken food is missing from the food library');
          }

          // Review queue: the dog's plan is still "suggested", so it is in "not checked by a vet".
          const queue = await http('GET', `${apiBase}/nutrition/animals?filter=to_review`, null, owner);
          if (!(queue.json?.data?.items || []).some(x => x.id === animalId)) problems.push(`the dog with an unreviewed plan is missing from the review queue (HTTP ${queue.status})`);

          // Prescribed diet: the cow's ration becomes an ordinary prescription the owner sees; never twice.
          const cowPlan = cowId ? (await http('GET', `${apiBase}/nutrition/animals/${cowId}`, null, owner)).json?.data?.plan : null;
          if (aTok && cowPlan?.id) {
            const ownerRx = await http('POST', `${apiBase}/nutrition/plans/${cowPlan.id}/prescribe`, { durationDays: 30 }, owner);
            if (ownerRx.status !== 403) problems.push(`a pet owner could prescribe a diet (HTTP ${ownerRx.status})`);
            const rx = await http('POST', `${apiBase}/nutrition/plans/${cowPlan.id}/prescribe`, { durationDays: 30, note: 'Verify diet' }, aTok);
            const rxId = rx.json?.data?.prescriptionId;
            if (rx.status !== 201 || !rxId || rx.json?.data?.plan?.validation !== 'vet_reviewed') problems.push(`prescribe the ration: HTTP ${rx.status} ${JSON.stringify(rx.json || {}).slice(0, 200)}`);
            else {
              const ownerList = await http('GET', `${apiBase}/prescriptions/animal/${cowId}`, null, owner);
              const listed = JSON.stringify(ownerList.json?.data || {});
              if (!listed.includes(rxId)) problems.push(`the prescribed diet is not in the owner's prescriptions for the animal (HTTP ${ownerList.status})`);
              const again = await http('POST', `${apiBase}/nutrition/plans/${cowPlan.id}/prescribe`, {}, aTok);
              if (again.status !== 400) problems.push(`the same plan was prescribed twice (HTTP ${again.status})`);
            }
          } else problems.push('could not find the cow ration (or the admin) to check the prescribed diet');

          // Alert outcomes: "Not right" on an open alert is kept as a labelled outcome; the admin sees the hit rate.
          const openFlags = (await http('GET', `${apiBase}/nutrition/animals/${animalId}`, null, owner)).json?.data?.flags || [];
          const toDismiss = openFlags.find(f => f.type === 'bcs_high') || openFlags[0];
          if (toDismiss) {
            const d = await http('PATCH', `${apiBase}/nutrition/flags/${toDismiss.id}`, { status: 'dismissed' }, owner);
            if (d.status !== 200) problems.push(`dismiss an alert: HTTP ${d.status}`);
            let labelled = [];
            try { labelled = psqlJson('verifydb', `SELECT outcome FROM ${SCHEMA}.nutrition_outcomes WHERE flag_id = '${toDismiss.id}'`); } catch { labelled = []; }
            if (!labelled.some(o => o.outcome === 'false_alarm')) problems.push('a "Not right" answer was not kept as an outcome label');
            const strangerFlag = await http('PATCH', `${apiBase}/nutrition/flags/${openFlags[1]?.id || toDismiss.id}`, { status: 'reviewed' }, stranger);
            if (strangerFlag.status !== 403) problems.push(`a stranger answered another owner's alert (HTTP ${strangerFlag.status})`);
          } else problems.push('no open alert to check outcome labelling');
          if (aTok) {
            const usage = await http('GET', `${apiBase}/nutrition/admin/usage?days=30`, null, aTok);
            if (usage.status !== 200 || !Array.isArray(usage.json?.data?.alerts)) problems.push(`admin usage with alert quality: HTTP ${usage.status}`);
          }

          // Explain: gated like the plan; with AI off it answers "unavailable" (the screen shows its own summary).
          if (planId) {
            const ex = await http('POST', `${apiBase}/nutrition/plans/${planId}/explain`, { language: 'hi' }, owner);
            if (ex.status !== 200 || ex.json?.data?.source !== 'unavailable') problems.push(`explain with AI off: HTTP ${ex.status} ${JSON.stringify(ex.json?.data || ex.json?.error || {}).slice(0, 160)}`);
            const exS = await http('POST', `${apiBase}/nutrition/plans/${planId}/explain`, { language: 'en' }, stranger);
            if (exS.status !== 403) problems.push(`a stranger had another owner's plan explained (HTTP ${exS.status})`);
          }

          // Herd ration: a 4-head cattle group on the seeded farmer's farm - one solve, totals x 4; a stranger is refused.
          const herdId = require('crypto').randomUUID();
          let herdOk = false;
          try {
            psql('verifydb', `SET search_path TO ${SCHEMA}, public;
              INSERT INTO animal_groups (id, enterprise_id, name, species, current_count)
              SELECT '${herdId}', e.id, 'Verify milking herd', 'Cattle', 4 FROM enterprises e JOIN users u ON u.id = e.owner_id
               WHERE u.email = 'tom.wilson@example.com' LIMIT 1;`);
            herdOk = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animal_groups WHERE id = '${herdId}'`).length === 1;
          } catch (e) { problems.push(`could not create a cattle herd for the herd-ration check: ${String(e.message).slice(0, 160)}`); }
          if (herdOk && fTok) {
            const card = await http('GET', `${apiBase}/nutrition/groups/${herdId}/feeding`, null, fTok);
            if (card.json?.data?.status !== 'herd_ration') problems.push(`a cattle group's feed card did not hand over to the herd ration (got ${card.json?.data?.status})`);
            const ov = await http('GET', `${apiBase}/nutrition/groups/${herdId}/ration`, null, fTok);
            if (ov.status !== 200 || !ov.json?.data?.rationAvailable || ov.json?.data?.group?.headCount !== 4) problems.push(`herd ration overview: HTTP ${ov.status} ${JSON.stringify(ov.json?.data || ov.json?.error || {}).slice(0, 200)}`);
            const gfoods = await http('GET', `${apiBase}/nutrition/foods?groupId=${herdId}`, null, fTok);
            const gc = Object.fromEntries((gfoods.json?.data?.items || []).map(f => [f.code, f.id]));
            const herdRation = { milkLitresPerDay: 8, avgWeightKg: 350, feeds: [
              { ingredientId: gc.feed_green_maize, pricePerKg: 2 }, { ingredientId: gc.feed_wheat_straw, pricePerKg: 6 },
              { ingredientId: gc.feed_cattle_feed, pricePerKg: 25 }, { ingredientId: gc.feed_mineral_mixture, pricePerKg: 80 },
            ] };
            if (herdRation.feeds.some(f => !f.ingredientId)) problems.push('the herd feed library (by group) is missing a common cattle feed');
            else {
              const hp = await http('POST', `${apiBase}/nutrition/groups/${herdId}/ration/preview`, herdRation, fTok);
              const herd = hp.json?.data?.herd;
              if (hp.status !== 200 || hp.json?.data?.result?.status !== 'ok' || herd?.headCount !== 4
                  || Math.abs(herd.totalCostPerDay - hp.json.data.result.totalCostPerDay * 4) > 0.05) {
                problems.push(`herd ration preview: HTTP ${hp.status} ${JSON.stringify(hp.json?.data?.result?.reasons || hp.json?.error || herd || {}).slice(0, 200)}`);
              }
              const hs = await http('POST', `${apiBase}/nutrition/groups/${herdId}/ration`, herdRation, fTok);
              if (hs.status !== 201 || hs.json?.data?.groupId !== herdId || !hs.json?.data?.ration?.herd) problems.push(`save herd ration: HTTP ${hs.status} ${JSON.stringify(hs.json || {}).slice(0, 200)}`);
              const again = await http('POST', `${apiBase}/nutrition/groups/${herdId}/ration`, herdRation, fTok);
              if (again.status !== 201) problems.push(`replacing the herd ration: HTTP ${again.status} (the old one must be superseded)`);
              const sv = await http('POST', `${apiBase}/nutrition/groups/${herdId}/ration/preview`, herdRation, stranger);
              if (sv.status !== 403) problems.push(`a stranger worked out another farm's herd ration (HTTP ${sv.status})`);
            }
          }
        }
      }
      // Only real SQL / database errors: the deliberate refusals above (400 / 403) are logged by the server too.
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (problems.length || sqlErrs.length) fail('Nutrition misbehaves on the real schema.', [...problems, ...sqlErrs]);
      else ok('write-through, body history, plan maths, safety alerts and access rules verified');
    }

    // ── PHASE 6f: no one reaches another person's animal (HARNESS rule H15, owner rule 2026-11-22) ──
    // The static guard (tests/unit/routeAccess.guard.test.ts) proves every route NAMES a gate; this proves the gates
    // actually refuse, on a real server: an owner's animal and its records, probed by a stranger and by a vet with no
    // appointment, through every animal endpoint - including the old trick of editing a record by its id while
    // sending one's own animal id in the body.
    if (serverHealthy && port) {
      step('PHASE 6f Cross-account: a stranger and an unbooked vet cannot reach another owner\'s animal');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const problems = [];
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 9000;
      const signUp = async (role) => {
        const email = `verify.h15.${role}.${Date.now()}.${seq}@example.com`;
        const body = { firstName: 'Probe', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`,
          password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-3';
        await http('POST', `${apiBase}/auth/register`, body);
        if (role === 'veterinarian') psql('verifydb', `SET search_path TO ${SCHEMA}, public; UPDATE users SET account_status = 'active', is_active = true WHERE email = '${email}';`);
        const login = await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' });
        return { token: login.json?.data?.token, id: login.json?.data?.user?.id };
      };
      const owner = await signUp('pet_owner');
      const stranger = await signUp('pet_owner');
      const vet = await signUp('veterinarian');
      if (!owner.token || !stranger.token || !vet.token) problems.push('could not create the owner / stranger / vet accounts');
      else {
        const mk = await http('POST', `${apiBase}/animals`, { name: 'Probe Target', species: 'Dog', gender: 'female' }, owner.token);
        const own = await http('POST', `${apiBase}/animals`, { name: 'Probe Own', species: 'Dog', gender: 'male' }, stranger.token);
        const id = mk.json?.data?.id;
        const strangerAnimal = own.json?.data?.id;
        if (!id || !strangerAnimal) problems.push(`could not create the probe animals (HTTP ${mk.status}/${own.status})`);
        else {
          await http('POST', `${apiBase}/weight-history`, { animalId: id, weight: 12, unit: 'kg' }, owner.token);
          const al = await http('POST', `${apiBase}/allergies`, { animalId: id, allergen: 'Probe pollen', severity: 'mild' }, owner.token);
          const allergyId = al.json?.data?.id;
          const reads = [
            `/animals/${id}`, `/weight-history/animal/${id}`, `/allergies/animal/${id}`, `/lab-results/animal/${id}`,
            `/vaccinations/animal/${id}`, `/timeline/animal/${id}`, `/consultations/animal/${id}`, `/prescriptions/animal/${id}`,
            `/certificates/animal/${id}`, `/animals/${id}/vaccine-assignments`, `/vaccine-schedule/animal/${id}`,
            `/vaccination-passport/animal/${id}`, `/vaccine-certificate-log/animal/${id}`, `/animals/${id}/lifetime-history`,
            `/geospatial/animals/${id}/trail`, `/genetic-profiles/${id}/lineage-tree`, `/nutrition/animals/${id}`,
            `/medical-records/stats?animalId=${id}`,
            // network-hospital routes (fixed with owner approval 2026-11-22)
            `/animals/${id}/care-contexts`, `/animals/${id}/referrals`, `/animals/${id}/hospital-visits`,
            `/workflow/animals/${id}/medical-summary`,
          ];
          for (const [who, tok] of [['stranger', stranger.token], ['unbooked vet', vet.token]]) {
            for (const p of reads) {
              const r = await http('GET', `${apiBase}${p}`, null, tok);
              if (r.status < 400) problems.push(`${who} could READ ${p} (HTTP ${r.status})`);
              else if (r.status === 403 && !(r.json?.message || r.json?.error?.message || r.json?.error)) problems.push(`${who} was refused ${p} without words`);
            }
            const writes = [
              ['POST', '/weight-history', { animalId: id, weight: 99, unit: 'kg' }],
              ['POST', '/allergies', { animalId: id, allergen: 'Planted', severity: 'mild' }],
              ['POST', '/vaccinations', { animalId: id, vaccineName: 'Planted', dateAdministered: '2026-11-01' }],
              ['POST', `/animals/${id}/vaccine-assignments`, { protocolId: '00000000-0000-4000-8000-000000000000' }],
              ...(allergyId ? [['PUT', `/allergies/${allergyId}`, { animalId: strangerAnimal, allergen: 'Hijacked' }]] : []),
            ];
            for (const [method, p, body] of writes) {
              const r = await http(method, `${apiBase}${p}`, body, tok);
              if (r.status < 400) problems.push(`${who} could WRITE ${method} ${p} (HTTP ${r.status})`);
            }
          }
          // List and search leaks
          const byOwner = await http('GET', `${apiBase}/animals?ownerId=${owner.id}`, null, vet.token);
          if (byOwner.status < 400 && (byOwner.json?.data?.animals || []).some(a => a.id === id)) problems.push('an unbooked vet listed another owner\'s animals via ?ownerId=');
          const patients = await http('GET', `${apiBase}/animals?view=patients`, null, vet.token);
          if ((patients.json?.data?.animals || []).some(a => a.id === id)) problems.push('a vet with no patients saw other owners\' animals in "patients"');
          const detail = await http('GET', `${apiBase}/animals/${id}`, null, owner.token);
          const uid = detail.json?.data?.uniqueId;
          if (uid) {
            const s = await http('GET', `${apiBase}/animals/search/by-uid?uid=${encodeURIComponent(uid)}`, null, stranger.token);
            if (s.status < 400) problems.push('a stranger found another owner\'s animal by its ID card number');
            const sv = await http('GET', `${apiBase}/animals/search/by-uid?uid=${encodeURIComponent(uid)}`, null, vet.token);
            if (sv.json?.data?.ownerEmail) problems.push('a vet\'s ID-card lookup exposed the owner\'s email');
          }
          // And the owner still has full access to their own animal.
          for (const p of [`/animals/${id}`, `/weight-history/animal/${id}`, `/allergies/animal/${id}`, `/timeline/animal/${id}`]) {
            const r = await http('GET', `${apiBase}${p}`, null, owner.token);
            if (r.status !== 200) problems.push(`the OWNER was refused their own ${p} (HTTP ${r.status})`);
          }
        }
      }
      if (problems.length) fail('Another person\'s animal data is reachable (or the owner is locked out).', problems);
      else ok('stranger and unbooked vet refused on every endpoint; owner keeps access');
    }

    // ── PHASE 6g: farm feed has ONE place to record it, and the safety fixes (migrations 063 / 064) ──
    // Owner rule 2026-11-23: no duplicate screens or double entry. Feed given is recorded only in Daily records; it takes
    // the feed out of stock and carries its cost; Feed Inventory holds stock and price; old "Log use" rows were moved.
    // Plus the domain-review SAFETY rows that need a real database: growing calves, unweaned calves, sheep copper.
    if (serverHealthy && port) {
      step('PHASE 6g Farm feed: one place to record it, stock and cost follow, and the safety rules hold');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      try {
        psql('verifydb', `SET search_path TO ${SCHEMA}, public;
          INSERT INTO system_settings (key, value, description) VALUES ('farm.records.enabled', 'true', 'enabled by runtime-verify PHASE 6g')
          ON CONFLICT (key) DO UPDATE SET value = 'true';
          INSERT INTO system_settings (key, value, description) VALUES ('nutrition.enabled', 'true', 'enabled by runtime-verify PHASE 6g')
          ON CONFLICT (key) DO UPDATE SET value = 'true';`);
      } catch { problems.push('could not switch farm records / nutrition on in the verification database'); }
      // The server caches each flag for 60 s, and the previous phase's probes may have cached "off": wait until it reports
      // both modules on (up to 90 s) instead of racing the cache.
      {
        const probe = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
        const tok = probe.json?.data?.token;
        const until = Date.now() + 90000;
        let on = false;
        while (tok && Date.now() < until) {
          const a = await http('GET', `${apiBase}/farm-records/enabled`, null, tok);
          const b = await http('GET', `${apiBase}/nutrition/enabled`, null, tok);
          if (a.json?.data?.enabled === true && b.json?.data?.enabled === true) { on = true; break; }
          await sleep(3000);
        }
        if (!on) problems.push('the server still reports farm records / nutrition off 90 s after they were switched on');
      }
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 31000;
      const signUp = async () => {
        const email = `verify.feed.${Date.now()}.${seq}@example.com`;
        await http('POST', `${apiBase}/auth/register`, { firstName: 'Feed', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`,
          password: 'Password1', confirmPassword: 'Password1', role: 'pet_owner', acceptTerms: true });
        return (await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' })).json?.data?.token;
      };
      const msgOf = (r) => r.json?.message || r.json?.error?.message || '';
      const login = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
      const farmer = login.json?.data?.token;
      const stranger = await signUp();
      let ent = null; let herd = null;
      try {
        ent = psqlJson('verifydb', `SELECT e.id FROM ${SCHEMA}.enterprises e JOIN ${SCHEMA}.users u ON u.id = e.owner_id WHERE u.email = 'tom.wilson@example.com' ORDER BY e.created_at LIMIT 1`)[0]?.id;
        herd = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animal_groups WHERE enterprise_id = '${ent}' AND species = 'Cattle' LIMIT 1`)[0]?.id;
      } catch { /* reported below */ }
      if (!farmer || !stranger || !ent || !herd) {
        problems.push('could not set up the seeded farmer, a stranger and a farm with a cattle herd for the feed journey');
      } else {
        // The old table is gone and the demo seed's feed rows live in Daily records, with their feed and cost.
        try {
          const t = psqlJson('verifydb', `SELECT to_regclass('${SCHEMA}.feed_consumption_logs')::text AS t`)[0]?.t;
          if (t) problems.push('feed_consumption_logs still exists - feed given must be recorded in one table only');
          const seeded = psqlJson('verifydb', `SELECT COUNT(*) AS n FROM ${SCHEMA}.farm_daily_records WHERE record_type = 'feed' AND feed_id IS NOT NULL AND cost IS NOT NULL`)[0]?.n;
          if (Number(seeded) < 4) problems.push(`the demo feed rows are not in Daily records with their feed and cost (found ${seeded})`);
          const unit = psqlJson('verifydb', `SELECT fields::text AS f FROM ${SCHEMA}.master_record_types WHERE code = 'sample_weight'`)[0]?.f || '';
          if (!/"unit"\s*:\s*"g"/.test(unit)) problems.push('the sample weight field does not carry its unit (g), so the entry cannot show it');
        } catch (e) { problems.push(`schema checks for the feed move failed: ${String(e.message).slice(0, 140)}`); }

        const feedPath = `${apiBase}/enterprises/${ent}/feed`;
        const stockOf = async (id) => ((await http('GET', feedPath, null, farmer)).json?.data?.items || []).find(f => f.id === id);
        // A bag needs its weight in kg, said in words.
        const noWeight = await http('POST', feedPath, { feedName: 'Verify no-weight bag', unit: 'bag', currentStock: 5, costPerUnit: 900 }, farmer);
        if (noWeight.status !== 400 || !/how many kg/i.test(msgOf(noWeight))) problems.push(`a bag with no kg weight was not refused in words (HTTP ${noWeight.status})`);
        const bag = await http('POST', feedPath, { feedName: 'Verify cattle feed bag', unit: 'bag', kgPerUnit: 50, currentStock: 10, minimumStock: 2, costPerUnit: 1200 }, farmer);
        const hay = await http('POST', feedPath, { feedName: 'Verify hay', unit: 'kg', currentStock: 500, minimumStock: 50, costPerUnit: 5 }, farmer);
        const bagId = bag.json?.data?.id; const hayId = hay.json?.data?.id;
        if (bag.status !== 201 || !bagId || hay.status !== 201 || !hayId) problems.push(`create stock items: HTTP ${bag.status} / ${hay.status} ${JSON.stringify(bag.json || {}).slice(0, 160)}`);
        else {
          const first = await stockOf(bagId);
          if (first?.stockKg !== 500) problems.push(`a bag of 50 kg x 10 should be 500 kg in store, got ${first?.stockKg}`);
          // Link the stock item to the library feed it is.
          const lib = (await http('GET', `${feedPath}/library`, null, farmer)).json?.data?.items || [];
          const maize = lib.find(x => x.code === 'feed_green_maize');
          if (!maize) problems.push('the feed library (GET .../feed/library) does not list the seeded feeds');
          else {
            const link = await http('PUT', `${apiBase}/feed/${bagId}`, { ingredientId: maize.id }, farmer);
            if (link.status !== 200 || link.json?.data?.ingredientId !== maize.id) problems.push(`linking a stock item to a library feed: HTTP ${link.status} ${msgOf(link)}`);
          }

          // Feed given: ONE place. 100 kg = 2 bags, costed at the stock price.
          const rec = (extra) => http('POST', `${apiBase}/farm-records`, { enterpriseId: ent, recordType: 'feed', ...extra }, farmer);
          const en = await http('GET', `${apiBase}/farm-records/enabled`, null, farmer);
          const r1 = await rec({ groupId: herd, quantity: 100, feedId: bagId });
          const s1 = await stockOf(bagId);
          if (r1.status >= 300 || r1.json?.data?.cost !== 2400 || s1?.currentStock !== 8) {
            problems.push(`recording 100 kg of a 50 kg bag: HTTP ${r1.status}, cost ${r1.json?.data?.cost} (want 2400), stock ${s1?.currentStock} (want 8) ${msgOf(r1)} | module enabled: ${JSON.stringify(en.json?.data)} | answer: ${JSON.stringify(r1.json).slice(0, 200)} | herd ${herd} farm ${ent}`);
          }
          // A correction moves only the difference: 150 kg = 3 bags in all, so one more bag.
          const r2 = await rec({ groupId: herd, quantity: 150, feedId: bagId });
          const s2 = await stockOf(bagId);
          if (r2.status >= 300 || s2?.currentStock !== 7 || r2.json?.data?.cost !== 3600) problems.push(`correcting the entry to 150 kg: stock ${s2?.currentStock} (want 7), cost ${r2.json?.data?.cost} (want 3600)`);
          // All my animals: no animal, no group.
          const r3 = await rec({ quantity: 50, feedId: bagId });
          const s3 = await stockOf(bagId);
          if (r3.status >= 300 || r3.json?.data?.wholeFarm !== true || s3?.currentStock !== 6) problems.push(`feed for all the farm's animals: HTTP ${r3.status}, wholeFarm ${r3.json?.data?.wholeFarm}, stock ${s3?.currentStock} (want 6) ${msgOf(r3)}`);
          const milkFarm = await http('POST', `${apiBase}/farm-records`, { enterpriseId: ent, recordType: 'milk', quantity: 5, session: 'am' }, farmer);
          if (milkFarm.status !== 400) problems.push(`milk was accepted for "all my animals" (HTTP ${milkFarm.status}) - only feed may be`);
          // Two feeds the same day for one group are two entries; home-grown touches no stock.
          const r4 = await rec({ groupId: herd, quantity: 20, feedId: hayId });
          const r5 = await rec({ groupId: herd, quantity: 30 });
          const sHay = await stockOf(hayId);
          if (r4.status >= 300 || r5.status >= 300 || sHay?.currentStock !== 480) problems.push(`a second feed and home-grown fodder the same day: HTTP ${r4.status}/${r5.status}, hay stock ${sHay?.currentStock} (want 480)`);
          const today = (await http('GET', `${apiBase}/farm-records?groupId=${herd}&recordType=feed&from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`, null, farmer)).json?.data?.items || [];
          if (today.length < 3) problems.push(`the herd's feed entries for today should be 3 (bag, hay, home-grown), got ${today.length}`);
          // Deleting the 150 kg entry puts its 3 bags back.
          const del = await http('DELETE', `${apiBase}/farm-records/${r2.json?.data?.id}`, null, farmer);
          const s4 = await stockOf(bagId);
          if (del.status >= 300 || s4?.currentStock !== 9) problems.push(`deleting a feed entry should put its stock back: HTTP ${del.status}, stock ${s4?.currentStock} (want 9)`);

          // Reports read the one table; the removed "Log use" answers in words.
          const wholeFarmRows = (await http('GET', `${apiBase}/farm-records?enterpriseId=${ent}&recordType=feed&wholeFarm=true`, null, farmer)).json?.data?.items || [];
          if (!wholeFarmRows.some(l => l.wholeFarm === true && l.feedId === bagId)) problems.push(`the whole-farm feed entry is not listed by Daily records (got ${wholeFarmRows.length})`);
          const an = await http('GET', `${feedPath}/analytics`, null, farmer);
          if (an.status !== 200 || !(an.json?.data?.consumptionByType || []).length) problems.push(`feed analytics from Daily records: HTTP ${an.status}`);
          const old = await http('POST', `${feedPath}/consumption`, { feedId: bagId, quantity: 5 }, farmer);
          if (old.status !== 410 || !/Daily records/.test(msgOf(old))) problems.push(`the removed "Log use" should say where to go (HTTP ${old.status}: ${msgOf(old).slice(0, 80)})`);

          // A purchase with a price writes the feed expense ONCE; without a price none.
          await http('POST', `${apiBase}/feed/${bagId}/restock`, { quantity: 2, pricePerUnit: 1300 }, farmer);
          await http('POST', `${apiBase}/feed/${bagId}/restock`, { quantity: 1 }, farmer);
          const exp = psqlJson('verifydb', `SELECT COUNT(*) AS n, MAX(amount) AS a FROM ${SCHEMA}.financial_records WHERE reference_id = '${bagId}' AND category = 'feed'`)[0];
          if (Number(exp?.n) !== 1 || Number(exp?.a) !== 2600) problems.push(`a priced restock should write ONE feed expense of 2600, got ${exp?.n} / ${exp?.a}`);

          // Rations take the price from the linked stock item (no typed price).
          const gf = await http('GET', `${apiBase}/nutrition/foods?groupId=${herd}`, null, farmer);
          const codes = Object.fromEntries((gf.json?.data?.items || []).map(f => [f.code, f.id]));
          const need = ['feed_green_maize', 'feed_wheat_straw', 'feed_cattle_feed', 'feed_groundnut_cake', 'feed_mineral_mixture'];
          if (need.some(c => !codes[c])) problems.push(`the herd's feed library is missing ${need.filter(c => !codes[c]).join(', ')}`);
          else {
            const body = (maizePrice) => ({ milkLitresPerDay: 8, avgWeightKg: 400, feeds: [
              { ingredientId: codes.feed_green_maize, ...(maizePrice === undefined ? {} : { pricePerKg: maizePrice }) }, { ingredientId: codes.feed_wheat_straw, pricePerKg: 6 },
              { ingredientId: codes.feed_cattle_feed, pricePerKg: 25 }, { ingredientId: codes.feed_groundnut_cake, pricePerKg: 45 }, { ingredientId: codes.feed_mineral_mixture, pricePerKg: 80 } ] });
            const typed = await http('POST', `${apiBase}/nutrition/groups/${herd}/ration/preview`, body(2), farmer);
            const fromStock = await http('POST', `${apiBase}/nutrition/groups/${herd}/ration/preview`, body(undefined), farmer);
            const a = typed.json?.data?.result?.totalCostPerDay; const b = fromStock.json?.data?.result?.totalCostPerDay;
            if (typed.status !== 200 || fromStock.status !== 200 || !(a > 0) || a !== b) problems.push(`the maize price must come from the linked stock item (24 per kg) and a typed price must not override it: typed ${a}, from stock ${b}`);
            const lines = typed.json?.data?.result?.lines || [];
            const min = lines.find(l => l.key === codes.feed_mineral_mixture);
            if (!min || Math.abs(min.kgAsFedPerDay - 0.05) > 0.0011) problems.push(`the mineral mixture should be the fixed 50 g a day, got ${min?.kgAsFedPerDay}`);
          }
        }

        // Safety: a stranger cannot touch this farm's stock.
        const fid = (await http('GET', feedPath, null, farmer)).json?.data?.items?.[0]?.id;
        const attempts = [
          ['POST', feedPath, { feedName: 'x', unit: 'kg' }], ['GET', feedPath], ['PUT', `${apiBase}/feed/${fid}`, { feedName: 'hacked' }],
          ['POST', `${apiBase}/feed/${fid}/restock`, { quantity: 1 }], ['DELETE', `${apiBase}/feed/${fid}`],
        ];
        const noSuchFeed = await http('PUT', `${apiBase}/feed/00000000-0000-4000-8000-000000000000`, { feedName: 'x' }, stranger);
        for (const [m, url, b] of attempts) {
          const r = await http(m, url, b || null, stranger);
          // The farm's own address answers 403; a feed id answers exactly as an id that does not exist (never confirms another farm's stock).
          const byFeedId = url.includes('/feed/');
          if (r.status !== (byFeedId ? 404 : 403)) problems.push(`a stranger could ${m} ${url.replace(apiBase, '')} on another farm's feed (HTTP ${r.status})`);
          else if (!msgOf(r) || /status code|undefined|\[object/i.test(msgOf(r))) problems.push(`the stranger's refusal on ${m} ${url.replace(apiBase, '')} has no readable message`);
          else if (byFeedId && (r.status !== noSuchFeed.status || msgOf(r) !== msgOf(noSuchFeed))) problems.push(`a real feed id and a made-up one must get the same answer (${m} ${url.replace(apiBase, '')})`);
        }

        // Safety: young stock, unweaned young, and sheep copper - on the real schema.
        const owner = await signUp();
        const mk = async (body, kg) => {
          const a = await http('POST', `${apiBase}/animals`, body, owner);
          const id = a.json?.data?.id;
          if (id && kg) await http('POST', `${apiBase}/nutrition/animals/${id}/measurements`, { weight: kg, unit: 'kg' }, owner);
          return id;
        };
        const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
        const calfId = await mk({ name: 'Verify Calf', species: 'Cattle', gender: 'female', dateOfBirth: daysAgo(150) }, 100);
        const babyId = await mk({ name: 'Verify Baby', species: 'Cattle', gender: 'female', dateOfBirth: daysAgo(30) }, 45);
        const sheepId = await mk({ name: 'Verify Sheep', species: 'Sheep', gender: 'female' }, 40);
        if (!calfId || !babyId || !sheepId) problems.push('could not create a calf, a baby calf and a sheep for the safety checks');
        else {
          const foods = async (id) => Object.fromEntries(((await http('GET', `${apiBase}/nutrition/foods?animalId=${id}`, null, owner)).json?.data?.items || []).map(f => [f.code, f.id]));
          const cf = await foods(calfId);
          const calfRation = await http('POST', `${apiBase}/nutrition/animals/${calfId}/ration/preview`, { feeds: [
            { ingredientId: cf.feed_green_maize, pricePerKg: 2 }, { ingredientId: cf.feed_groundnut_cake, pricePerKg: 45 }, { ingredientId: cf.feed_berseem, pricePerKg: 3 } ] }, owner);
          if (calfRation.status !== 200 || calfRation.json?.data?.stage?.growing !== true || calfRation.json?.data?.state !== 'growing') {
            problems.push(`a 5-month-old calf must be rationed as GROWING (HTTP ${calfRation.status}, state ${calfRation.json?.data?.state}) ${msgOf(calfRation).slice(0, 100)}`);
          }
          const bf = await foods(babyId);
          const baby = await http('POST', `${apiBase}/nutrition/animals/${babyId}/ration/preview`, { feeds: [{ ingredientId: bf.feed_green_maize, pricePerKg: 2 }] }, owner);
          if (baby.status !== 400 || !/still on milk/i.test(msgOf(baby))) problems.push(`a 30-day-old calf was given a fodder ration instead of being sent to a vet (HTTP ${baby.status}: ${msgOf(baby).slice(0, 80)})`);
          else if (baby.json?.error?.code !== 'NEEDS_VET') problems.push(`the young-calf refusal must carry the NEEDS_VET code so the screen can offer a vet (got ${baby.json?.error?.code})`);
          const sf = await foods(sheepId);
          const sheep = await http('POST', `${apiBase}/nutrition/animals/${sheepId}/ration/preview`, { feeds: [
            { ingredientId: sf.feed_green_maize, pricePerKg: 2 }, { ingredientId: sf.feed_cattle_feed, pricePerKg: 25 } ] }, owner);
          if (sheep.status !== 400 || !/not safe/i.test(msgOf(sheep))) problems.push(`cattle compound feed (copper) was accepted for a sheep (HTTP ${sheep.status}: ${msgOf(sheep).slice(0, 80)})`);
          const sheepOk = await http('POST', `${apiBase}/nutrition/animals/${sheepId}/ration/preview`, { feeds: [
            { ingredientId: sf.feed_green_maize, pricePerKg: 2 }, { ingredientId: sf.feed_groundnut_cake, pricePerKg: 45 }, { ingredientId: sf.feed_mineral_mixture_small, pricePerKg: 90 } ] }, owner);
          if (sheepOk.status !== 200) problems.push(`a sheep ration with the low-copper mineral was refused (HTTP ${sheepOk.status}: ${msgOf(sheepOk).slice(0, 100)})`);
        }
        // "Neutered?" is asked of a new pet (unanswered is NULL, not "no"), and a "no" answer is kept - the question stops.
        const rexId = await mk({ name: 'Verify Rex', species: 'Dog', gender: 'male' }, 20);
        if (!rexId) problems.push('could not create a dog for the neutered check');
        else {
          const asks = async () => ((await http('GET', `${apiBase}/nutrition/animals/${rexId}`, null, owner)).json?.data?.missingFacts || []).map(m => m.key);
          if (!(await asks()).includes('isNeutered')) problems.push('a new dog was never asked whether it is neutered (an unanswered pet is fed as if intact)');
          const ans = await http('PATCH', `${apiBase}/nutrition/animals/${rexId}/facts`, { isNeutered: false }, owner);
          if (ans.status !== 200 || (await asks()).includes('isNeutered')) problems.push(`answering "not neutered" must stop the question (HTTP ${ans.status})`);
          const dbv = psqlJson('verifydb', `SELECT is_neutered FROM ${SCHEMA}.animals WHERE id = '${rexId}'`)[0]?.is_neutered;
          if (dbv !== false) problems.push(`the "no" answer was not kept as false (got ${dbv})`);
        }
      }
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (problems.length || sqlErrs.length) fail('Farm feed or the nutrition safety rules misbehave on the real schema.', [...problems, ...sqlErrs]);
      else ok('one place for feed; stock, cost and reports follow; strangers refused; calves, lambs and copper handled');
    }


    // ── PHASE 6h: a recorded condition needs a vet first; alerts reach people; the herd ration shows on a member;
    //    wellness values come from records; dashboard numbers; neutral refusals; observation weight kept once ──
    if (serverHealthy && port) {
      step('PHASE 6h Nutrition connections: condition gate, alerts to people, herd ration on a member, wellness from records');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 52000;
      const signUp = async (role) => {
        const email = `verify.conn.${role}.${Date.now()}.${seq}@example.com`;
        await http('POST', `${apiBase}/auth/register`, { firstName: 'Conn', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`,
          password: 'Password1', confirmPassword: 'Password1', role: 'pet_owner', acceptTerms: true });
        if (role === 'admin') psql('verifydb', `SET search_path TO ${SCHEMA}, public; UPDATE users SET role = 'admin', account_status = 'active', is_active = true WHERE email = '${email}';`);
        return (await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' })).json?.data?.token;
      };
      const msgOf = (r) => r.json?.message || r.json?.error?.message || '';
      const owner = await signUp('pet_owner');
      const stranger = await signUp('pet_owner');
      const admin = await signUp('admin');
      const farmer = (await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' })).json?.data?.token;
      if (!owner || !stranger || !admin || !farmer) problems.push('could not create the owner / stranger / admin accounts or sign in the seeded farmer');
      else {
        // 1. A recorded condition: the new plan waits for a vet, the plan in use does not change.
        const dog = (await http('POST', `${apiBase}/animals`, { name: 'Verify Kidney Dog', species: 'Dog', gender: 'male' }, owner)).json?.data?.id;
        if (!dog) problems.push('could not create a dog for the condition check');
        else {
          await http('PATCH', `${apiBase}/nutrition/animals/${dog}/facts`, { dateOfBirth: '2019-03-01', isNeutered: true, activityLevel: 'moderate', housing: 'indoor' }, owner);
          await http('POST', `${apiBase}/nutrition/animals/${dog}/measurements`, { weight: 30, unit: 'kg', bodyConditionScore: 8, bcsScale: 9 }, owner);
          const plan = { goal: 'lose', mealsPerDay: 2, foods: [{ label: 'Verify kibble', kcalPer100g: 350, sharePct: 100 }] };
          const first = await http('POST', `${apiBase}/nutrition/animals/${dog}/plan`, plan, owner);
          if (first.status !== 201 || first.json?.data?.status !== 'active') problems.push(`a healthy dog's plan should be active at once (HTTP ${first.status}, ${first.json?.data?.status}) ${msgOf(first).slice(0, 100)}`);
          const ownerId = psqlJson('verifydb', `SELECT owner_id FROM ${SCHEMA}.animals WHERE id = '${dog}'`)[0]?.owner_id;
          psql('verifydb', `SET search_path TO ${SCHEMA}, public; INSERT INTO medical_records (user_id, animal_id, record_type, title, content, status) VALUES ('${ownerId}', '${dog}', 'diagnosis', 'Chronic kidney disease', 'stage 2', 'active');`);
          const second = await http('POST', `${apiBase}/nutrition/animals/${dog}/plan`, { ...plan, mealsPerDay: 3 }, owner);
          const draftId = second.json?.data?.id;
          if (second.status !== 201 || second.json?.data?.status !== 'draft' || !(second.json?.data?.conditions || []).includes('kidney')) {
            problems.push(`a plan for a dog with kidney disease on record must wait for a vet (HTTP ${second.status}, status ${second.json?.data?.status}, conditions ${JSON.stringify(second.json?.data?.conditions)})`);
          }
          const ov = await http('GET', `${apiBase}/nutrition/animals/${dog}`, null, owner);
          if (ov.json?.data?.plan?.id !== first.json?.data?.id) problems.push('the plan in use changed before any vet looked at the new plan');
          if (!draftId || ov.json?.data?.pendingPlan?.id !== draftId) problems.push('the waiting plan is not shown as pending on the animal');
          const ownerReview = await http('POST', `${apiBase}/nutrition/plans/${draftId}/review`, { note: 'x' }, owner);
          if (ownerReview.status < 400) problems.push(`the owner could review a waiting plan as a vet (HTTP ${ownerReview.status})`);
          const big = await http('POST', `${apiBase}/nutrition/plans/${draftId}/review`, { overrideKcal: 3000 }, admin);
          if (big.status !== 400 || !/reason/i.test(msgOf(big))) problems.push(`a number far from the calculated one with no reason must be refused in words (HTTP ${big.status}: ${msgOf(big).slice(0, 80)})`);
          const rev = await http('POST', `${apiBase}/nutrition/plans/${draftId}/review`, { note: 'Checked with the owner' }, admin);
          if (rev.status >= 300) problems.push(`a vet's review of the waiting plan: HTTP ${rev.status} ${msgOf(rev).slice(0, 100)}`);
          const ov2 = await http('GET', `${apiBase}/nutrition/animals/${dog}`, null, owner);
          if (ov2.json?.data?.plan?.id !== draftId || ov2.json?.data?.pendingPlan) problems.push('after the vet review the waiting plan must be the plan in use and nothing must be pending');

          // 2. The alert reached the owner (one note, in the ordinary notifications list).
          const nn = psqlJson('verifydb', `SELECT COUNT(*) AS n FROM ${SCHEMA}.notifications WHERE user_id = '${ownerId}' AND metadata->>'type' = 'nutrition_flag'`)[0]?.n;
          if (Number(nn) < 1) problems.push('a new feeding alert sent the owner no notification');
          else if (Number(nn) > 3) problems.push(`one alert must not notify again and again (got ${nn} notes)`);

          // 3. Dashboard numbers follow the same access as the animal list.
          const sum = await http('GET', `${apiBase}/nutrition/summary`, null, owner);
          if (sum.status !== 200 || !(sum.json?.data?.total >= 1) || !(sum.json?.data?.attention >= 1)) problems.push(`dashboard summary: HTTP ${sum.status} ${JSON.stringify(sum.json?.data || {})}`);
          const sumOther = await http('GET', `${apiBase}/nutrition/summary`, null, stranger);
          if (sumOther.json?.data?.total !== 0) problems.push(`a stranger's dashboard counts another owner's animals (total ${sumOther.json?.data?.total})`);

          // 4. Wellness: nutrition, activity and weight come from records; typed ones are refused; strangers are refused.
          const typed = await http('POST', `${apiBase}/wellness/scorecards`, { animalId: dog, nutritionScore: 99 }, owner);
          // The request validator drops fields it does not know, so a typed value is ignored rather than refused - it must never be kept.
          if (typed.status === 201 && Number(typed.json?.data?.nutrition_score) === 99) problems.push('a typed nutrition score was stored - it must come from the records');
          else if (typed.status !== 201 && typed.status !== 400) problems.push(`a typed nutrition score: unexpected HTTP ${typed.status}`);
          const sc = await http('POST', `${apiBase}/wellness/scorecards`, { animalId: dog, vaccinationScore: 80, dentalScore: 70 }, owner);
          const row = sc.json?.data;
          if (sc.status !== 201 || Number(row?.activity_score) !== 70 || row?.weight_status !== 'obese' || row?.nutrition_score === null || row?.nutrition_score === undefined) {
            problems.push(`the scorecard must take nutrition, activity (moderate = 70) and weight (body condition 8 = obese) from records: HTTP ${sc.status} ${JSON.stringify(row || {}).slice(0, 200)}`);
          }
          const scStranger = await http('POST', `${apiBase}/wellness/scorecards`, { animalId: dog, vaccinationScore: 80 }, stranger);
          if (scStranger.status !== 403) problems.push(`a stranger created a scorecard for another owner's animal (HTTP ${scStranger.status})`);
          if (row?.id) {
            const up = await http('PUT', `${apiBase}/wellness/scorecards/${row.id}`, { dentalScore: 1 }, stranger);
            const del = await http('DELETE', `${apiBase}/wellness/scorecards/${row.id}`, null, stranger);
            if (up.status !== 403 || del.status !== 403) problems.push(`a stranger could change or delete another owner's scorecard (HTTP ${up.status} / ${del.status})`);
          }
        }

        // 4b. A cow with a condition on record: the ration waits for a vet too.
        {
          const cowC = (await http('POST', `${apiBase}/animals`, { name: 'Verify Kidney Cow', species: 'Cattle', gender: 'female' }, owner)).json?.data?.id;
          if (cowC) {
            await http('POST', `${apiBase}/nutrition/animals/${cowC}/measurements`, { weight: 400, unit: 'kg' }, owner);
            const fl = Object.fromEntries(((await http('GET', `${apiBase}/nutrition/foods?animalId=${cowC}`, null, owner)).json?.data?.items || []).map(f => [f.code, f.id]));
            const need = ['feed_green_maize', 'feed_wheat_straw', 'feed_cattle_feed', 'feed_groundnut_cake', 'feed_mineral_mixture'];
            if (need.every(c => fl[c])) {
              const body = { milkLitresPerDay: 10, feeds: need.map((c, i) => ({ ingredientId: fl[c], pricePerKg: [2, 6, 25, 45, 80][i] })) };
              const own = psqlJson('verifydb', `SELECT owner_id FROM ${SCHEMA}.animals WHERE id = '${cowC}'`)[0]?.owner_id;
              const plain = await http('POST', `${apiBase}/nutrition/animals/${cowC}/ration`, body, owner);
              if (plain.status !== 201 || plain.json?.data?.status !== 'active') problems.push(`a healthy cow's ration should be active at once (HTTP ${plain.status}, ${plain.json?.data?.status})`);
              psql('verifydb', `SET search_path TO ${SCHEMA}, public; INSERT INTO medical_records (user_id, animal_id, record_type, title, content, status) VALUES ('${own}', '${cowC}', 'diagnosis', 'Liver disease', 'chronic', 'active');`);
              const waiting = await http('POST', `${apiBase}/nutrition/animals/${cowC}/ration`, body, owner);
              const ovC = await http('GET', `${apiBase}/nutrition/animals/${cowC}`, null, owner);
              if (waiting.status !== 201 || waiting.json?.data?.status !== 'draft' || ovC.json?.data?.plan?.id !== plain.json?.data?.id || ovC.json?.data?.pendingPlan?.id !== waiting.json?.data?.id) {
                problems.push(`a ration for a cow with liver disease on record must wait for a vet and leave the one in use alone (HTTP ${waiting.status}, ${waiting.json?.data?.status})`);
              }
              const listC = await http('GET', `${apiBase}/nutrition/animals?search=Verify%20Kidney%20Cow`, null, owner);
              if (!(listC.json?.data?.items || []).some(x => x.id === cowC && x.plan)) problems.push('the animal list does not show the plan of the cow');
            }
          }
        }

        // 5. A herd's ration shows on each member animal, read-only.
        let ent = null; let herd = null; let cow = null;
        try {
          ent = psqlJson('verifydb', `SELECT e.id FROM ${SCHEMA}.enterprises e JOIN ${SCHEMA}.users u ON u.id = e.owner_id WHERE u.email = 'tom.wilson@example.com' ORDER BY e.created_at LIMIT 1`)[0]?.id;
          herd = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animal_groups WHERE enterprise_id = '${ent}' AND species = 'Cattle' LIMIT 1`)[0]?.id;
          cow = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animals WHERE enterprise_id = '${ent}' AND species = 'Cattle' AND is_active = true LIMIT 1`)[0]?.id;
        } catch { /* reported below */ }
        if (!ent || !herd || !cow) problems.push('could not find the seeded farm, its cattle herd and a cow for the herd-ration check');
        else {
          psql('verifydb', `SET search_path TO ${SCHEMA}, public; INSERT INTO animal_group_memberships (animal_id, group_id) SELECT '${cow}', '${herd}' WHERE NOT EXISTS (SELECT 1 FROM animal_group_memberships WHERE animal_id = '${cow}' AND group_id = '${herd}' AND left_at IS NULL);`);
          const items = (await http('GET', `${apiBase}/nutrition/foods?groupId=${herd}`, null, farmer)).json?.data?.items || [];
          const code = Object.fromEntries(items.map(f => [f.code, f.id]));
          const feeds = ['feed_green_maize', 'feed_wheat_straw', 'feed_cattle_feed', 'feed_groundnut_cake', 'feed_mineral_mixture'];
          if (feeds.some(c => !code[c])) problems.push('the herd feed library is missing feeds for the herd-ration check');
          else {
            const saved = await http('POST', `${apiBase}/nutrition/groups/${herd}/ration`, { milkLitresPerDay: 8, avgWeightKg: 400,
              feeds: feeds.map((c, i) => ({ ingredientId: code[c], pricePerKg: [2, 6, 25, 45, 80][i] })) }, farmer);
            if (saved.status >= 300) problems.push(`save the herd ration: HTTP ${saved.status} ${msgOf(saved).slice(0, 100)}`);
            const member = await http('GET', `${apiBase}/nutrition/animals/${cow}`, null, farmer);
            if (!member.json?.data?.herdPlan?.id || !member.json?.data?.herdName) problems.push(`the herd's ration is not shown on a member animal (HTTP ${member.status})`);
          }
        }

        // 5b. Finance: feed cost is entered once (Feed Inventory restock), and finance / compliance rows belong to their farm.
        if (ent) {
          const typedFeed = await http('POST', `${apiBase}/enterprises/${ent}/financial`, { enterpriseId: ent, recordType: 'expense', category: 'feed', amount: 100, transactionDate: new Date().toISOString().slice(0, 10) }, farmer);
          if (typedFeed.status !== 400 || !/Feed Inventory/.test(msgOf(typedFeed))) problems.push(`a hand-typed feed expense must be refused with a pointer to Feed Inventory (HTTP ${typedFeed.status}: ${msgOf(typedFeed).slice(0, 80)})`);
          const vet = await http('POST', `${apiBase}/enterprises/${ent}/financial`, { enterpriseId: ent, recordType: 'expense', category: 'veterinary', amount: 250, transactionDate: new Date().toISOString().slice(0, 10) }, farmer);
          const finId = vet.json?.data?.id;
          if (vet.status !== 201 || !finId) problems.push(`a veterinary expense on the farm's own finance: HTTP ${vet.status} ${msgOf(vet).slice(0, 100)}`);
          else {
            const strangerPut = await http('PUT', `${apiBase}/financial/${finId}`, { amount: 1 }, stranger);
            const strangerDel = await http('DELETE', `${apiBase}/financial/${finId}`, null, stranger);
            const fakeDel = await http('DELETE', `${apiBase}/financial/00000000-0000-4000-8000-000000000002`, null, stranger);
            if (strangerPut.status !== 404 || strangerDel.status !== 404 || msgOf(strangerDel) !== msgOf(fakeDel)) problems.push(`a stranger could change another farm's finance entry, or got a different answer than for a made-up id (HTTP ${strangerPut.status} / ${strangerDel.status})`);
          }
          const strangerFin = await http('POST', `${apiBase}/enterprises/${ent}/financial`, { enterpriseId: ent, recordType: 'expense', category: 'veterinary', amount: 1, transactionDate: new Date().toISOString().slice(0, 10) }, stranger);
          if (strangerFin.status !== 403) problems.push(`a stranger added a finance entry to another farm (HTTP ${strangerFin.status})`);
        }

        // 6. Neutral refusals and the observation weight kept in one place.
        try {
          const feedId = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.feed_inventory WHERE is_active = true LIMIT 1`)[0]?.id;
          if (feedId) {
            const real = await http('PUT', `${apiBase}/feed/${feedId}`, { feedName: 'hacked' }, stranger);
            const fake = await http('PUT', `${apiBase}/feed/00000000-0000-4000-8000-000000000001`, { feedName: 'hacked' }, stranger);
            if (real.status !== fake.status || msgOf(real) !== msgOf(fake) || !msgOf(real)) problems.push(`a real feed id and a made-up one must get the same answer (HTTP ${real.status} vs ${fake.status})`);
          }
        } catch { /* no feed rows to probe */ }
        if (ent) {
          const strangerObs = await http('POST', `${apiBase}/enterprises/${ent}/health/observations`, { enterpriseId: ent, title: 'x', weight: 1 }, stranger);
          if (strangerObs.status !== 403) problems.push(`a stranger could add a health note to another farm (HTTP ${strangerObs.status})`);
          const cow2 = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animals WHERE enterprise_id = '${ent}' AND is_active = true LIMIT 1`)[0]?.id;
          const foreignAnimal = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animals WHERE enterprise_id IS DISTINCT FROM '${ent}' AND is_active = true LIMIT 1`)[0]?.id;
          if (foreignAnimal) {
            const cross = await http('POST', `${apiBase}/enterprises/${ent}/health/observations`, { enterpriseId: ent, animalId: foreignAnimal, title: 'x', weight: 1 }, farmer);
            if (cross.status !== 400) problems.push(`a health note naming an animal from another farm must be refused (HTTP ${cross.status})`);
          }
          if (cow2) {
            const obs = await http('POST', `${apiBase}/enterprises/${ent}/health/observations`, { enterpriseId: ent, animalId: cow2, title: 'Verify weigh-in', severity: 'low', weight: 411, weightUnit: 'kg' }, farmer);
            const obsId = obs.json?.data?.id;
            if (obs.status !== 201 || !obsId) problems.push(`add a health note with a weight: HTTP ${obs.status} ${msgOf(obs).slice(0, 100)}`);
            else {
              const copy = psqlJson('verifydb', `SELECT weight FROM ${SCHEMA}.health_observations WHERE id = '${obsId}'`)[0]?.weight;
              const hist = psqlJson('verifydb', `SELECT COUNT(*) AS n FROM ${SCHEMA}.weight_history WHERE source = 'health_observation' AND source_id = '${obsId}' AND weight = 411`)[0]?.n;
              if (copy !== null) problems.push(`the observation kept its own copy of the weight (${copy}) - weight lives in the body-measurement history only`);
              if (Number(hist) !== 1) problems.push(`the observation's weight is not in the weight history (found ${hist})`);
              const listed = (await http('GET', `${apiBase}/enterprises/${ent}/health/observations?animalId=${cow2}`, null, farmer)).json?.data?.items || [];
              if (!listed.some(o => o.id === obsId && Number(o.weight) === 411)) problems.push('the health note list does not show the weight read from the weight history');
              const strangerResolve = await http('PATCH', `${apiBase}/health/observations/${obsId}/resolve`, {}, stranger);
              if (strangerResolve.status !== 404) problems.push(`a stranger resolved another farm's health note (HTTP ${strangerResolve.status})`);
            }
          }
        }
      }
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (problems.length || sqlErrs.length) fail('The nutrition connections misbehave on the real schema.', [...problems, ...sqlErrs]);
      else ok('conditions wait for a vet; alerts notify once; herd ration on members; wellness from records; strangers refused; weight kept once');
    }


    // ── PHASE 6i: treatment and withdrawal - one prescription feeds the whole farm (migration 067) ──
    // A vet types the label's days on the prescription; the farm's banner, due list, warnings and "my medicines" are worked out
    // from it. The platform ships no medicine list: every name below is made up for this check.
    if (serverHealthy && port) {
      step('PHASE 6i Treatment and withdrawal: label days on the prescription, one answer everywhere, warn-and-confirm');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 61000;
      const signUp = async (role) => {
        const email = `verify.wd.${role}.${Date.now()}.${seq}@example.com`;
        await http('POST', `${apiBase}/auth/register`, { firstName: 'Wd', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`,
          password: 'Password1', confirmPassword: 'Password1', role: 'pet_owner', acceptTerms: true });
        if (role === 'admin') psql('verifydb', `SET search_path TO ${SCHEMA}, public; UPDATE users SET role = 'admin', account_status = 'active', is_active = true WHERE email = '${email}';`);
        return (await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' })).json?.data?.token;
      };
      const msgOf = (r) => r.json?.message || r.json?.error?.message || '';
      const codeOf = (r) => r.json?.error?.code || '';
      const admin = await signUp('admin');
      const stranger = await signUp('pet_owner');
      const petOwner = await signUp('pet_owner');
      const farmer = (await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' })).json?.data?.token;
      let ent = null; let herd = null; let cow = null; let cow2 = null; let tomId = null;
      try {
        ent = psqlJson('verifydb', `SELECT e.id FROM ${SCHEMA}.enterprises e JOIN ${SCHEMA}.users u ON u.id = e.owner_id WHERE u.email = 'tom.wilson@example.com' ORDER BY e.created_at LIMIT 1`)[0]?.id;
        tomId = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.users WHERE email = 'tom.wilson@example.com'`)[0]?.id;
        herd = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animal_groups WHERE enterprise_id = '${ent}' AND species = 'Cattle' LIMIT 1`)[0]?.id;
        const cows = psqlJson('verifydb', `SELECT id FROM ${SCHEMA}.animals WHERE enterprise_id = '${ent}' AND species = 'Cattle' AND is_active = true ORDER BY created_at LIMIT 2`);
        cow = cows[0]?.id; cow2 = cows[1]?.id;
      } catch { /* reported below */ }
      if (!admin || !stranger || !petOwner || !farmer || !ent || !herd || !cow || !tomId) problems.push('could not set up the accounts, the seeded farm, its cattle herd and a cow for the withdrawal journey');
      else {
        const rx = (body) => http('POST', `${apiBase}/prescriptions`, { petOwnerId: tomId, diagnosis: 'Verify', instructions: '', ...body }, admin);
        const line = (extra) => ({ name: 'Verify Product', dosage: '5 ml', frequency: 'Once daily', ...extra });

        // 1. A food-producing animal: the label days are required, in words.
        const bare = await rx({ animalId: cow, medications: [line({ treatmentDays: 2 })] });
        if (bare.status !== 400 || !/withdrawal days from the product label/.test(msgOf(bare))) problems.push(`a medicine for a cow with no label days must be refused in words (HTTP ${bare.status}: ${msgOf(bare).slice(0, 100)})`);
        const noDays = await rx({ animalId: cow, medications: [line({ withdrawalMilkDays: 3, withdrawalMeatDays: 10 })] });
        if (noDays.status !== 400 || !/how many days the treatment lasts/.test(msgOf(noDays))) problems.push(`a medicine with no treatment days must be refused in words (HTTP ${noDays.status})`);
        // A diet line is exempt.
        const diet = await rx({ animalId: cow2 || cow, medications: [{ name: 'Verify diet', dosage: '2 kg', frequency: 'Daily', kind: 'diet' }] });
        if (diet.status !== 201) problems.push(`a diet line for a cow must not ask for withdrawal days (HTTP ${diet.status}: ${msgOf(diet).slice(0, 100)})`);

        // 2. The vet's answer is stored, and the withdrawal is worked out from it.
        const good = await rx({ animalId: cow, medications: [line({ treatmentDays: 2, withdrawalMilkDays: 3, withdrawalMeatDays: 10 })] });
        const rxId = good.json?.data?.id;
        if (good.status !== 201 || !rxId) problems.push(`a cow prescription with label days: HTTP ${good.status} ${msgOf(good).slice(0, 120)}`);
        else {
          const st = await http('GET', `${apiBase}/animals/${cow}/withdrawal`, null, farmer);
          // start day = day 1: a 2-day course from today has its last dose tomorrow; milk +3, meat +10.
          if (st.status !== 200 || st.json?.data?.milkUntil !== iso(4) || st.json?.data?.meatUntil !== iso(11) || st.json?.data?.foodProducing !== true) {
            problems.push(`the cow's withdrawal should be milk ${iso(4)} / meat ${iso(11)} (HTTP ${st.status}: ${JSON.stringify(st.json?.data || {}).slice(0, 220)})`);
          }
          // 3. Warn and confirm: milk, then a sale. Not a silent block.
          const milkBody = { enterpriseId: ent, animalId: cow, recordType: 'milk', session: 'am', quantity: 6 };
          const warn = await http('POST', `${apiBase}/farm-records`, milkBody, farmer);
          if (warn.status !== 409 || codeOf(warn) !== 'WITHDRAWAL_CONFIRM' || !/withdrawal until/.test(msgOf(warn))) problems.push(`milk from a cow under withdrawal must ask first, in words (HTTP ${warn.status}, ${codeOf(warn)}: ${msgOf(warn).slice(0, 100)})`);
          const sure = await http('POST', `${apiBase}/farm-records`, { ...milkBody, confirmWithdrawal: true }, farmer);
          if (sure.status >= 300) problems.push(`milk saved after the person confirmed: HTTP ${sure.status} ${msgOf(sure).slice(0, 100)}`);
          const sale = await http('POST', `${apiBase}/farm-records/events`, { animalId: cow, eventType: 'sale' }, farmer);
          if (sale.status !== 409 || codeOf(sale) !== 'WITHDRAWAL_CONFIRM') problems.push(`selling a cow under a meat withdrawal must ask first (HTTP ${sale.status}, ${codeOf(sale)}: ${msgOf(sale).slice(0, 100)})`);

          // 4. The due list (reminders) comes from the same answer.
          const due = (await http('GET', `${apiBase}/farm-records/due?enterpriseId=${ent}`, null, farmer)).json?.data?.items || [];
          if (!due.some(d => d.kind === 'withdrawal_ending' && d.animalId === cow && d.detail === 'milk')) problems.push('the due list does not show the cow\'s milk withdrawal ending');

          // 5. "Stopped early": the farm corrects the course; a stranger cannot.
          const fixed = await http('PATCH', `${apiBase}/treatments/prescriptions/${rxId}/course`, { lastDoseOn: iso(0) }, farmer);
          if (fixed.status !== 200 || fixed.json?.data?.milkUntil !== iso(3)) problems.push(`"stopped early" should move milk to ${iso(3)} (HTTP ${fixed.status}: ${JSON.stringify(fixed.json?.data || {}).slice(0, 160)})`);
          const bad = await http('PATCH', `${apiBase}/treatments/prescriptions/${rxId}/course`, { lastDoseOn: iso(-30) }, farmer);
          if (bad.status !== 400) problems.push(`a last dose before the treatment started must be refused (HTTP ${bad.status})`);
          const strangerFix = await http('PATCH', `${apiBase}/treatments/prescriptions/${rxId}/course`, { lastDoseOn: iso(0) }, stranger);
          const strangerRead = await http('GET', `${apiBase}/animals/${cow}/withdrawal`, null, stranger);
          if (strangerFix.status !== 403 || strangerRead.status !== 403) problems.push(`a stranger could change or read another farm's withdrawal (HTTP ${strangerFix.status} / ${strangerRead.status})`);
          const back = await http('PATCH', `${apiBase}/treatments/prescriptions/${rxId}/course`, { lastDoseOn: null }, farmer);
          if (back.json?.data?.milkUntil !== iso(4)) problems.push('"back to as prescribed" did not restore the dates');
        }

        // 6. The farm's history, and the farmer's own treatment (same facts, one history).
        const selfBad = await http('POST', `${apiBase}/enterprises/${ent}/treatments`, { animalId: cow2 || cow, medicineName: 'Verify Own', treatmentDays: 1, withdrawalMeatDays: 5 }, farmer);
        if (selfBad.status !== 400) problems.push(`a treatment with a missing label figure must be refused (HTTP ${selfBad.status})`);
        const self = await http('POST', `${apiBase}/enterprises/${ent}/treatments`, { animalId: cow2 || cow, medicineName: 'Verify Own', treatmentDays: 1, withdrawalMilkDays: 0, withdrawalMeatDays: 5 }, farmer);
        if (self.status !== 201) problems.push(`the farmer's own treatment: HTTP ${self.status} ${msgOf(self).slice(0, 100)}`);
        const hist = (await http('GET', `${apiBase}/enterprises/${ent}/treatments`, null, farmer)).json?.data || {};
        if (!(hist.history || []).some(h => h.medicine === 'Verify Product' && h.source === 'prescription') || !(hist.history || []).some(h => h.medicine === 'Verify Own' && h.source === 'self')) problems.push('the treatment history must hold the vet\'s prescription and the farmer\'s own entry');
        if (!(hist.history || []).every(h => h.medicine !== 'Verify diet')) problems.push('a diet line must not appear as a medicine in the history');
        if (!(hist.underWithdrawal || []).some(u => u.what === 'meat' && u.medicine === 'Verify Own')) problems.push('the farmer\'s own treatment does not hold meat back');
        const strangerSelf = await http('POST', `${apiBase}/enterprises/${ent}/treatments`, { animalId: cow, medicineName: 'x', treatmentDays: 1, withdrawalMilkDays: 0, withdrawalMeatDays: 0 }, stranger);
        const strangerHist = await http('GET', `${apiBase}/enterprises/${ent}/treatments`, null, stranger);
        if (strangerSelf.status !== 403 || strangerHist.status !== 403) problems.push(`a stranger could add to or read another farm's treatments (HTTP ${strangerSelf.status} / ${strangerHist.status})`);

        // 7. A herd: medicated feed with its label days; the herd and its members are under withdrawal.
        const herdRx = await rx({ groupId: herd, medications: [line({ name: 'Verify Medicated Feed', kind: 'medicated_feed', dosage: '100 g/head', treatmentDays: 5, withdrawalMilkDays: 2, withdrawalMeatDays: 7 })] });
        if (herdRx.status !== 201) problems.push(`a herd prescription with a medicated-feed line: HTTP ${herdRx.status} ${msgOf(herdRx).slice(0, 120)}`);
        else {
          const hst = await http('GET', `${apiBase}/animal-groups/${herd}/withdrawal`, null, farmer);
          if (hst.json?.data?.meatActive !== true || hst.json?.data?.meatUntil !== iso(11)) problems.push(`the herd's meat withdrawal should run to ${iso(11)} (${JSON.stringify(hst.json?.data || {}).slice(0, 160)})`);
          psql('verifydb', `SET search_path TO ${SCHEMA}, public; INSERT INTO animal_group_memberships (animal_id, group_id) SELECT '${cow2 || cow}', '${herd}' WHERE NOT EXISTS (SELECT 1 FROM animal_group_memberships WHERE animal_id = '${cow2 || cow}' AND group_id = '${herd}' AND left_at IS NULL);`);
          const member = await http('GET', `${apiBase}/animals/${cow2 || cow}/withdrawal`, null, farmer);
          if (member.json?.data?.meatActive !== true) problems.push('an animal in a treated herd must carry the herd\'s withdrawal');
          const courses = await http('GET', `${apiBase}/treatments/groups/${herd}/feed-courses`, null, farmer);
          if (courses.status !== 200 || !(courses.json?.data || []).some(c => c.medicine === 'Verify Medicated Feed' && c.daysLeft >= 1)) problems.push(`the running medicated-feed course is not offered on the feed entry (HTTP ${courses.status}: ${JSON.stringify(courses.json?.data || {}).slice(0, 140)})`);
          const strangerCourses = await http('GET', `${apiBase}/treatments/groups/${herd}/feed-courses`, null, stranger);
          if (strangerCourses.status !== 403) problems.push(`a stranger read a herd's medicated-feed course (HTTP ${strangerCourses.status})`);
          const note = psqlJson('verifydb', `SELECT COUNT(*) AS n FROM ${SCHEMA}.notifications WHERE user_id = '${tomId}' AND metadata->>'type' = 'withdrawal_started'`)[0]?.n;
          if (Number(note) < 1) problems.push('the farm owner was not told that a prescription holds milk and meat back');
        }

        // 8. A pet needs no label days; the vet's own recent medicines are offered back (and only to a vet).
        const dog = (await http('POST', `${apiBase}/animals`, { name: 'Verify Wd Dog', species: 'Dog', gender: 'male' }, petOwner)).json?.data?.id;
        const dogOwner = dog ? psqlJson('verifydb', `SELECT owner_id FROM ${SCHEMA}.animals WHERE id = '${dog}'`)[0]?.owner_id : null;
        if (dog && dogOwner) {
          const pet = await http('POST', `${apiBase}/prescriptions`, { petOwnerId: dogOwner, animalId: dog, diagnosis: 'Verify', medications: [line({ name: 'Verify Pet Product' })] }, admin);
          if (pet.status !== 201) problems.push(`a pet prescription must not ask for withdrawal days (HTTP ${pet.status}: ${msgOf(pet).slice(0, 100)})`);
        }
        const recent = await http('GET', `${apiBase}/treatments/my-recent-lines`, null, admin);
        const mine = (recent.json?.data || []).find(l => l.name === 'Verify Product');
        if (recent.status !== 200 || mine?.withdrawalMilkDays !== 3 || mine?.withdrawalMeatDays !== 10 || mine?.treatmentDays !== 2) problems.push(`the vet's recent medicines must bring back the label days they typed (HTTP ${recent.status}: ${JSON.stringify(mine || {}).slice(0, 140)})`);
        const notVet = await http('GET', `${apiBase}/treatments/my-recent-lines`, null, farmer);
        if (notVet.status !== 403) problems.push(`the recent-medicines list must be for vets only (HTTP ${notVet.status})`);

        // 9. The movement interlock (slaughter / export) reads the same answer: it blocks, in words.
        const certBlocked = await http('POST', `${apiBase}/movements`, { enterpriseId: ent, animalId: cow, movementType: 'slaughter', reason: 'Verify' }, farmer);
        if (certBlocked.status !== 400 || !/withdrawal until/.test(msgOf(certBlocked))) problems.push(`a slaughter movement during a meat withdrawal must be refused in words (HTTP ${certBlocked.status}: ${msgOf(certBlocked).slice(0, 100)})`);
      }
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (problems.length || sqlErrs.length) fail('Treatment and withdrawal misbehave on the real schema.', [...problems, ...sqlErrs]);
      else ok('label days on the prescription; one withdrawal answer for banner, due list, herd and movement; warn-and-confirm; strangers refused');
    }

    // ── PHASE 6j: withdrawal follow-ups (migration 068): course start day, "record anyway" log, own-treatment idempotency,
    // farm treatments on the animal's timeline, "bought on", and the pharmacy's product kind / label days / line matches ──
    if (serverHealthy && port) {
      step('PHASE 6j Withdrawal follow-ups: course start, override log, idempotent own treatment, timeline, bought-on, pharmacy line matches');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 71000;
      const msgOf = (r) => r.json?.message || r.json?.error?.message || '';
      const codeOf = (r) => r.json?.error?.code || '';
      // A refusal must say what happened in words: no HTTP code, no stack, no raw error text.
      const plain = (r) => { const m = msgOf(r); return m.length >= 12 && !/status code|\bHTTP\b|\b[45]\d\d\b|\bat .+\(|undefined|\[object|Error:|violates|syntax/i.test(m); };
      const sql = (q) => psql('verifydb', `SET search_path TO ${SCHEMA}, public; ${q}`);
      const rows = (q) => psqlJson('verifydb', q);
      const S = SCHEMA;
      const uuid = () => require('crypto').randomUUID();
      const signUp = async (role, dbRole) => {
        const email = `verify.wf.${role}.${Date.now()}.${seq}@example.com`;
        const body = { firstName: 'Wf', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`, password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-6J';
        await http('POST', `${apiBase}/auth/register`, body);
        if (dbRole || role === 'veterinarian') sql(`UPDATE users SET ${dbRole ? `role = '${dbRole}', ` : ''}account_status = 'active', is_active = true WHERE email = '${email}';`);
        const login = await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' });
        return { token: login.json?.data?.token, id: login.json?.data?.user?.id };
      };
      const admin = await signUp('pet_owner', 'admin');
      const stranger = await signUp('pet_owner');
      const worker = await signUp('pet_owner');
      const viewer = await signUp('pet_owner');
      const unbookedVet = await signUp('veterinarian');
      const bookedVet = await signUp('veterinarian');
      const pharmacist = await signUp('pet_owner', 'pharmacist');
      const otherPharmacist = await signUp('pet_owner', 'pharmacist'); // a pharmacist of ANOTHER network
      const farmerLogin = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
      const farmer = farmerLogin.json?.data?.token;
      const tomId = farmerLogin.json?.data?.user?.id;
      let ent = null;
      try { ent = rows(`SELECT e.id FROM ${S}.enterprises e JOIN ${S}.users u ON u.id = e.owner_id WHERE u.email = 'tom.wilson@example.com' ORDER BY e.created_at LIMIT 1`)[0]?.id; } catch { /* reported below */ }
      const everyone = [admin, stranger, worker, viewer, unbookedVet, bookedVet, pharmacist, otherPharmacist];
      if (everyone.some(u => !u.token || !u.id) || !farmer || !tomId || !ent) problems.push('could not set up the accounts and the seeded farm for the withdrawal follow-ups');
      else {
        const rx = (body, tok = admin.token) => http('POST', `${apiBase}/prescriptions`, { petOwnerId: tomId, diagnosis: 'Verify', instructions: '', ...body }, tok);
        const line = (extra) => ({ name: 'Verify Wf Product', dosage: '5 ml', frequency: 'Once daily', treatmentDays: 2, withdrawalMilkDays: 3, withdrawalMeatDays: 10, ...extra });
        const newCow = async (name) => (await http('POST', `${apiBase}/animals`, { name, species: 'Cattle', gender: 'female', enterpriseId: ent }, farmer)).json?.data?.id;
        const wd = (id, tok) => http('GET', `${apiBase}/animals/${id}/withdrawal`, null, tok);
        sql(`INSERT INTO enterprise_members (enterprise_id, user_id, role) VALUES ('${ent}', '${worker.id}', 'worker'), ('${ent}', '${viewer.id}', 'viewer') ON CONFLICT DO NOTHING;`);

        // ── 1. Migration 068 / init.sql ──
        const cols = rows(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = '${S}' AND table_name IN ('prescriptions','medical_records','pharmacy_medications')`);
        const has = (t, c) => cols.some(x => x.table_name === t && x.column_name === c);
        const tbl = rows(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${S}' AND table_name = 'withdrawal_overrides'`);
        if (!has('prescriptions', 'course_start_on')) problems.push('prescriptions.course_start_on is missing after boot');
        if (!tbl.length) problems.push('table withdrawal_overrides is missing after boot');
        for (const [t, c] of [['medical_records', 'withdrawal_until_milk'], ['medical_records', 'withdrawal_until_meat'], ['pharmacy_medications', 'withdrawal_days_milk'], ['pharmacy_medications', 'withdrawal_days_meat'], ['pharmacy_medications', 'withdrawal_period_days']]) {
          if (has(t, c)) problems.push(`${t}.${c} should have been dropped but still exists`);
        }
        for (const c of ['withdrawal_milk_days', 'withdrawal_meat_days', 'product_kind']) if (!has('pharmacy_medications', c)) problems.push(`pharmacy_medications.${c} is missing`);

        // ── 2. The vet picks the course start ──
        const cowToday = await newCow('Verify Wf Today');
        const cowTomorrow = await newCow('Verify Wf Tomorrow');
        if (!cowToday || !cowTomorrow) problems.push('could not add the cows for the course-start check');
        else {
          sql(`INSERT INTO bookings (pet_owner_id, veterinarian_id, animal_id, enterprise_id, scheduled_date, time_slot_start, time_slot_end, status) VALUES ('${tomId}', '${bookedVet.id}', '${cowToday}', '${ent}', CURRENT_DATE, '10:00', '10:30', 'confirmed');`);
          const same = await rx({ animalId: cowToday, medications: [line()] });
          const later = await rx({ animalId: cowTomorrow, courseStartOn: iso(1), medications: [line()] });
          if (same.status !== 201) problems.push(`a same-day cow prescription: HTTP ${same.status} ${msgOf(same).slice(0, 100)}`);
          if (later.status !== 201) problems.push(`a cow prescription starting tomorrow: HTTP ${later.status} ${msgOf(later).slice(0, 100)}`);
          const a = (await wd(cowToday, farmer)).json?.data; const b = (await wd(cowTomorrow, farmer)).json?.data;
          if (a?.milkUntil !== iso(4) || b?.milkUntil !== iso(5) || a?.meatUntil !== iso(11) || b?.meatUntil !== iso(12)) {
            problems.push(`starting tomorrow must move the withdrawal one day later: same-day milk ${a?.milkUntil} meat ${a?.meatUntil}, tomorrow milk ${b?.milkUntil} meat ${b?.meatUntil} (expected ${iso(4)}/${iso(11)} and ${iso(5)}/${iso(12)})`);
          }
          const old = await rx({ animalId: cowToday, courseStartOn: iso(-60), medications: [line()] });
          const far = await rx({ animalId: cowToday, courseStartOn: iso(30), medications: [line()] });
          const junk = await rx({ animalId: cowToday, courseStartOn: '2026-13-45', medications: [line()] });
          for (const [what, r] of [['60 days ago', old], ['30 days ahead', far], ['not a real date', junk]]) {
            if (r.status !== 400 || !plain(r)) problems.push(`a course start of ${what} must be refused in plain words (HTTP ${r.status}: ${msgOf(r).slice(0, 120)})`);
          }
          const after = (await wd(cowToday, farmer)).json?.data;
          if (after?.milkUntil !== iso(4)) problems.push('a refused prescription changed the animal\'s withdrawal');
          // a pet: harmless
          const dog = (await http('POST', `${apiBase}/animals`, { name: 'Verify Wf Dog', species: 'Dog', gender: 'male' }, stranger.token)).json?.data?.id;
          if (dog) {
            const pet = await http('POST', `${apiBase}/prescriptions`, { petOwnerId: stranger.id, animalId: dog, diagnosis: 'Verify', courseStartOn: iso(1), medications: [{ name: 'Verify Pet Product', dosage: '1', frequency: 'Daily' }] }, admin.token);
            if (pet.status !== 201) problems.push(`a pet prescription with a course start day: HTTP ${pet.status} ${msgOf(pet).slice(0, 100)}`);
          } else problems.push('could not add the pet for the course-start check');
          // every persona sees the same answer; a stranger and the unbooked vet are refused in words
          for (const [who, tok] of [['farm owner', farmer], ['farm worker', worker.token], ['farm viewer', viewer.token], ['admin', admin.token], ['booked vet', bookedVet.token]]) {
            const r = await wd(cowToday, tok);
            if (r.status !== 200 || r.json?.data?.milkUntil !== iso(4)) problems.push(`${who} reading the withdrawal: HTTP ${r.status} milk ${r.json?.data?.milkUntil} (expected ${iso(4)})`);
          }
          for (const [who, tok] of [['stranger', stranger.token], ['unbooked vet', unbookedVet.token]]) {
            const r = await wd(cowToday, tok);
            if (r.status !== 403 || !plain(r)) problems.push(`${who} reading another farm's withdrawal must be refused in words (HTTP ${r.status}: ${msgOf(r).slice(0, 100)})`);
          }
        }

        // ── 3. Warn-and-confirm: translatable params + one override row per confirmation ──
        const overrides = (animal) => rows(`SELECT * FROM ${S}.withdrawal_overrides WHERE animal_id = '${animal}'`);
        const cowMilk = await newCow('Verify Wf Milk'); const cowSale = await newCow('Verify Wf Sale');
        const cowList = await newCow('Verify Wf Listing'); const cowFree = await newCow('Verify Wf Free');
        if (![cowMilk, cowSale, cowList, cowFree].every(Boolean)) problems.push('could not add the cows for the warn-and-confirm check');
        else {
          for (const c of [cowMilk, cowSale, cowList]) {
            const r = await rx({ animalId: c, medications: [line({ name: 'Verify Wf Override Drug' })] });
            if (r.status !== 201) problems.push(`prescription for the confirm check: HTTP ${r.status} ${msgOf(r).slice(0, 100)}`);
          }
          const checkParams = (r, action, what, label) => {
            const p = r.json?.error?.params;
            if (r.status !== 409 || codeOf(r) !== 'WITHDRAWAL_CONFIRM') { problems.push(`${label} under withdrawal must ask first (HTTP ${r.status}, code ${codeOf(r)}: ${msgOf(r).slice(0, 100)})`); return; }
            if (!plain(r)) problems.push(`${label}: the warning is not plain words: ${msgOf(r).slice(0, 100)}`);
            const keys = ['what', 'name', 'group', 'until', 'medicine', 'action'];
            if (!p || keys.some(k => !(k in p))) problems.push(`${label}: error.params must carry ${keys.join(', ')} but is ${JSON.stringify(p)}`);
            else if (p.what !== what || p.action !== action || p.medicine !== 'Verify Wf Override Drug' || p.group !== false || !/^\d{4}-\d{2}-\d{2}$/.test(p.until) || !p.name) problems.push(`${label}: params wrong: ${JSON.stringify(p)}`);
          };
          const checkRow = (animal, action, what, label) => {
            const o = overrides(animal);
            const untilExpect = what === 'milk' ? iso(4) : iso(11);
            if (o.length !== 1) problems.push(`${label}: confirming must write exactly one withdrawal_overrides row, found ${o.length}`);
            else {
              const x = o[0];
              if (x.user_id !== tomId || x.enterprise_id !== ent || x.action !== action || x.withheld !== what || String(x.until_date).slice(0, 10) !== untilExpect || x.medicine !== 'Verify Wf Override Drug') {
                problems.push(`${label}: override row wrong: ${JSON.stringify({ user: x.user_id === tomId, farm: x.enterprise_id === ent, action: x.action, withheld: x.withheld, until: x.until_date, medicine: x.medicine })} (expected ${action}/${what}/${untilExpect})`);
              }
            }
          };
          const milk = { enterpriseId: ent, animalId: cowMilk, recordType: 'milk', session: 'am', quantity: 6 };
          checkParams(await http('POST', `${apiBase}/farm-records`, milk, farmer), 'milk_entry', 'milk', 'milk entry');
          if (overrides(cowMilk).length) problems.push('asking (without confirming) wrote an override row');
          const m2 = await http('POST', `${apiBase}/farm-records`, { ...milk, confirmWithdrawal: true }, farmer);
          if (m2.status >= 300) problems.push(`milk saved after confirming: HTTP ${m2.status} ${msgOf(m2).slice(0, 100)}`); else checkRow(cowMilk, 'milk_entry', 'milk', 'milk entry');
          checkParams(await http('POST', `${apiBase}/farm-records/events`, { animalId: cowSale, eventType: 'sale' }, farmer), 'animal_sale', 'meat', 'animal sale');
          const s2 = await http('POST', `${apiBase}/farm-records/events`, { animalId: cowSale, eventType: 'sale', confirmWithdrawal: true }, farmer);
          if (s2.status >= 300) problems.push(`sale saved after confirming: HTTP ${s2.status} ${msgOf(s2).slice(0, 100)}`); else checkRow(cowSale, 'animal_sale', 'meat', 'animal sale');
          const listing = { title: 'Verify Wf cow for sale', description: 'runtime verification', category: 'animal', listingType: 'fixed_price', price: 5000, quantity: 1, unit: 'head', species: 'cattle', contactPhone: '9876543210', state: 'Kerala', district: 'Thrissur', pincode: '680001', linkedAnimalId: cowList };
          const l1 = await http('POST', `${apiBase}/marketplace/listings`, listing, farmer);
          if (l1.status === 409 && codeOf(l1) === 'WITHDRAWAL_CONFIRM') {
            if (!plain(l1) || l1.json?.error?.params?.action !== 'listing' || l1.json?.error?.params?.what !== 'meat') problems.push(`listing warning params wrong: ${JSON.stringify(l1.json?.error?.params)}`);
            const l2 = await http('POST', `${apiBase}/marketplace/listings`, { ...listing, confirmWithdrawal: true }, farmer);
            if (l2.status >= 300) problems.push(`listing after confirming: HTTP ${l2.status} ${msgOf(l2).slice(0, 120)}`); else checkRow(cowList, 'listing', 'meat', 'marketplace listing');
          } else problems.push(`listing an animal under a meat withdrawal must ask first (HTTP ${l1.status}, code ${codeOf(l1)}: ${msgOf(l1).slice(0, 120)})`);
          const free = await http('POST', `${apiBase}/farm-records`, { enterpriseId: ent, animalId: cowFree, recordType: 'milk', session: 'am', quantity: 4, confirmWithdrawal: true }, farmer);
          if (free.status >= 300) problems.push(`milk from an animal with no withdrawal: HTTP ${free.status} ${msgOf(free).slice(0, 100)}`);
          if (overrides(cowFree).length) problems.push('confirming when nothing is held back wrote an override row');
        }

        // ── 4. Own treatment is idempotent; who may add one ──
        const cowSelf = await newCow('Verify Wf Self');
        const tid = uuid();
        const own = { id: tid, animalId: cowSelf, medicineName: 'Verify Wf Own', treatmentDays: 2, withdrawalMilkDays: 1, withdrawalMeatDays: 4 };
        const t1 = await http('POST', `${apiBase}/enterprises/${ent}/treatments`, own, farmer);
        const t2 = await http('POST', `${apiBase}/enterprises/${ent}/treatments`, own, farmer);
        const nRows = Number(rows(`SELECT COUNT(*) AS n FROM ${S}.self_treatments WHERE id = '${tid}'`)[0]?.n);
        if (t1.status !== 201 || t2.status !== 201) problems.push(`sending the same own treatment twice: HTTP ${t1.status} then ${t2.status} ${msgOf(t2).slice(0, 100)}`);
        if (nRows !== 1) problems.push(`the same client id sent twice must leave ONE self_treatments row, found ${nRows}`);
        if (t2.json?.data?.id !== tid) problems.push(`the repeat should answer with the first row's id, got ${t2.json?.data?.id}`);
        const dupHist = ((await http('GET', `${apiBase}/enterprises/${ent}/treatments`, null, farmer)).json?.data?.history || []).filter(h => h.medicine === 'Verify Wf Own');
        if (dupHist.length !== 1) problems.push(`the farm history shows the own treatment ${dupHist.length} times, expected once`);
        const w1 = await http('POST', `${apiBase}/enterprises/${ent}/treatments`, { animalId: cowSelf, medicineName: 'Verify Wf Worker', treatmentDays: 1, withdrawalMilkDays: 0, withdrawalMeatDays: 0 }, worker.token);
        if (w1.status !== 201) problems.push(`a farm worker entering a treatment: HTTP ${w1.status} ${msgOf(w1).slice(0, 100)}`);
        for (const [who, tok] of [['farm viewer (no record right)', viewer.token], ['stranger', stranger.token], ['unbooked vet', unbookedVet.token]]) {
          const r = await http('POST', `${apiBase}/enterprises/${ent}/treatments`, { animalId: cowSelf, medicineName: 'Verify Wf Nope', treatmentDays: 1, withdrawalMilkDays: 0, withdrawalMeatDays: 0 }, tok);
          if (r.status !== 403 || !plain(r)) problems.push(`${who} adding a treatment must be refused in words (HTTP ${r.status}: ${msgOf(r).slice(0, 100)})`);
          if (!who.startsWith('farm viewer')) {
            const h = await http('GET', `${apiBase}/enterprises/${ent}/treatments`, null, tok);
            if (h.status !== 403 || !plain(h)) problems.push(`${who} reading the farm's treatments must be refused in words (HTTP ${h.status}: ${msgOf(h).slice(0, 100)})`);
          }
        }
        if (Number(rows(`SELECT COUNT(*) AS n FROM ${S}.self_treatments WHERE medicine_name = 'Verify Wf Nope'`)[0]?.n) !== 0) problems.push('a refused person still created a treatment row');

        // ── 5. The animal's timeline carries the farm's own treatment ──
        sql(`INSERT INTO bookings (pet_owner_id, veterinarian_id, animal_id, enterprise_id, scheduled_date, time_slot_start, time_slot_end, status) VALUES ('${tomId}', '${bookedVet.id}', '${cowSelf}', '${ent}', CURRENT_DATE, '11:00', '11:30', 'confirmed');`);
        await rx({ animalId: cowSelf, medications: [line({ name: 'Verify Wf Timeline Rx' })] });
        for (const [who, tok] of [['farm owner', farmer], ['farm worker', worker.token], ['admin', admin.token], ['booked vet', bookedVet.token]]) {
          const all = await http('GET', `${apiBase}/timeline/animal/${cowSelf}`, null, tok);
          const hit = (all.json?.data || []).find(i => i.type === 'self_treatment');
          if (all.status !== 200 || !hit || !/^Treated by the farm: Verify Wf Own/.test(hit.title || '')) problems.push(`${who}: the timeline should list "Treated by the farm: Verify Wf Own" (HTTP ${all.status}, types ${JSON.stringify((all.json?.data || []).map(i => i.type))})`);
          const onlyRx = await http('GET', `${apiBase}/timeline/animal/${cowSelf}?types=prescription`, null, tok);
          const types = (onlyRx.json?.data || []).map(i => i.type);
          if (!types.includes('self_treatment') || !types.includes('prescription')) problems.push(`${who}: types=prescription must return prescriptions AND the farm's own treatment, got ${JSON.stringify(types)}`);
        }
        const onlyWeight = await http('GET', `${apiBase}/timeline/animal/${cowSelf}?types=weight`, null, farmer);
        if ((onlyWeight.json?.data || []).some(i => i.type === 'self_treatment')) problems.push('types=weight must not return the farm\'s own treatment');
        for (const [who, tok] of [['stranger', stranger.token], ['unbooked vet', unbookedVet.token]]) {
          const r = await http('GET', `${apiBase}/timeline/animal/${cowSelf}`, null, tok);
          if (r.status !== 403 || !plain(r)) problems.push(`${who} reading another farm's timeline must be refused in words (HTTP ${r.status}: ${msgOf(r).slice(0, 100)})`);
        }

        // ── pharmacy fixtures: two networks, two pharmacies in the first, a pharmacist for each network ──
        const net1 = uuid(); const net2 = uuid(); const phA = uuid(); const phB = uuid(); const phC = uuid();
        sql(`INSERT INTO hospital_networks (id, name) VALUES ('${net1}', 'Verify Wf Network One'), ('${net2}', 'Verify Wf Network Two');
             INSERT INTO hospital_pharmacies (id, network_id, pharmacy_name) VALUES ('${phA}', '${net1}', 'Verify Wf Pharmacy A'), ('${phB}', '${net1}', 'Verify Wf Pharmacy B'), ('${phC}', '${net2}', 'Verify Wf Pharmacy C');
             INSERT INTO hospital_network_members (network_id, user_id, network_role) VALUES ('${net1}', '${pharmacist.id}', 'hospital_staff'), ('${net2}', '${otherPharmacist.id}', 'hospital_staff');`);

        // ── 6. Farmer history: "bought on" once the pharmacy has handed the medicine over ──
        const cowBuy = await newCow('Verify Wf Bought');
        const buyRx = await rx({ animalId: cowBuy, medications: [line({ name: 'Verify Wf Bought Drug' })] });
        const buyId = buyRx.json?.data?.id;
        const boughtOf = async (tok) => ((await http('GET', `${apiBase}/enterprises/${ent}/treatments`, null, tok)).json?.data?.history || []).find(h => h.medicine === 'Verify Wf Bought Drug');
        if (!buyId) problems.push(`prescription for the bought-on check: HTTP ${buyRx.status} ${msgOf(buyRx).slice(0, 100)}`);
        else {
          const before = await boughtOf(farmer);
          if (!before || before.boughtOn !== null) problems.push(`before any dispensing the history row must carry boughtOn: null, got ${JSON.stringify(before?.boughtOn)}`);
          sql(`INSERT INTO dispensing_records (prescription_id, pharmacy_id, pharmacist_id, dispensing_status) VALUES ('${buyId}', '${phA}', '${pharmacist.id}', 'prepared');`);
          const prepared = await boughtOf(farmer);
          if (prepared?.boughtOn) problems.push(`a prepared (not handed over) dispensing must not set boughtOn, got ${prepared.boughtOn}`);
          sql(`INSERT INTO dispensing_records (prescription_id, pharmacy_id, pharmacist_id, dispensing_status, handed_over_at) VALUES ('${buyId}', '${phA}', '${pharmacist.id}', 'handed_over', NOW());`);
          for (const [who, tok] of [['farm owner', farmer], ['farm worker', worker.token], ['farm viewer', viewer.token], ['admin', admin.token]]) {
            const h = await boughtOf(tok);
            const ok1 = h && [iso(-1), iso(0), iso(1)].includes(h.boughtOn);
            if (!ok1) problems.push(`${who}: after hand-over the history row must carry boughtOn = today, got ${JSON.stringify(h?.boughtOn)}`);
            else if (h.milkUntil !== iso(3) && h.milkUntil !== iso(4)) problems.push(`${who}: buying the medicine must not change the withdrawal, milkUntil is ${h.milkUntil}`);
          }
        }

        // ── 7. Pharmacy: product kind, label days, matches (network zone fixtures built above) ──
        const med = await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Wf Stock Item', product_kind: 'diet', withdrawal_milk_days: 3, withdrawal_meat_days: 7 }, pharmacist.token);
        const medId = med.json?.id;
        if (med.status !== 201 || !medId || med.json?.product_kind !== 'diet' || med.json?.withdrawal_milk_days !== 3 || med.json?.withdrawal_meat_days !== 7) problems.push(`adding a diet product with label days: HTTP ${med.status} ${JSON.stringify(med.json || {}).slice(0, 200)}`);
        const badKind = await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Wf Bad Kind', product_kind: 'potion' }, pharmacist.token);
        if (badKind.status !== 400 || !plain(badKind)) problems.push(`an unknown product kind must be refused in words (HTTP ${badKind.status}: ${msgOf(badKind).slice(0, 100)})`);
        for (const bad of [-1, 400, 2.5, 'abc']) {
          const r = await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Wf Bad Days', withdrawal_meat_days: bad }, pharmacist.token);
          if (r.status !== 400 || !plain(r)) problems.push(`withdrawal days of ${JSON.stringify(bad)} must be refused in words (HTTP ${r.status}: ${msgOf(r).slice(0, 100)})`);
        }
        if (Number(rows(`SELECT COUNT(*) AS n FROM ${S}.pharmacy_medications WHERE name LIKE 'Verify Wf Bad%'`)[0]?.n) !== 0) problems.push('a refused product was still saved');
        const notMember = await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Wf Intruder' }, otherPharmacist.token);
        if (notMember.status !== 403 || !plain(notMember)) problems.push(`a pharmacist of another network adding a product must be refused in words (HTTP ${notMember.status}: ${msgOf(notMember).slice(0, 100)})`);
        const noClear = await http('PATCH', `${apiBase}/networks/${net1}/medications/${medId}`, { unit_cost: 5 }, pharmacist.token);
        if (noClear.json?.withdrawal_milk_days !== 3 || noClear.json?.withdrawal_meat_days !== 7 || noClear.json?.product_kind !== 'diet') problems.push(`an edit that leaves the label days out must keep them: ${JSON.stringify({ k: noClear.json?.product_kind, m: noClear.json?.withdrawal_milk_days, e: noClear.json?.withdrawal_meat_days })} (HTTP ${noClear.status})`);
        const clear = await http('PATCH', `${apiBase}/networks/${net1}/medications/${medId}`, { withdrawal_milk_days: null }, pharmacist.token);
        if (clear.status !== 200 || clear.json?.withdrawal_milk_days !== null || clear.json?.withdrawal_meat_days !== 7) problems.push(`withdrawal_milk_days:null must clear milk and keep meat: HTTP ${clear.status} ${JSON.stringify({ m: clear.json?.withdrawal_milk_days, e: clear.json?.withdrawal_meat_days })}`);
        const badPatch = await http('PATCH', `${apiBase}/networks/${net1}/medications/${medId}`, { product_kind: 'potion' }, pharmacist.token);
        if (badPatch.status !== 400 || !plain(badPatch)) problems.push(`an edit with an unknown kind must be refused in words (HTTP ${badPatch.status})`);
        // a second, switched-off item must not be offered; one product of the other network must not be reachable
        const off = await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Wf Switched Off' }, pharmacist.token);
        if (off.json?.id) await http('PATCH', `${apiBase}/networks/${net1}/medications/${off.json.id}`, { is_active: false }, pharmacist.token);
        const foreign = await http('POST', `${apiBase}/networks/${net2}/medications`, { name: 'Verify Wf Foreign Item', product_kind: 'medicine' }, otherPharmacist.token);
        const foreignId = foreign.json?.id;
        if (!foreignId) problems.push(`the other network's pharmacist adding a product: HTTP ${foreign.status} ${JSON.stringify(foreign.json || {}).slice(0, 120)}`);

        for (const [who, tok] of [['pharmacist', pharmacist.token], ['admin', admin.token]]) {
          const r = await http('GET', `${apiBase}/pharmacies/${phA}/medications`, null, tok);
          const names = (Array.isArray(r.json) ? r.json : []).map(x => x.name);
          if (r.status !== 200 || !names.includes('Verify Wf Stock Item') || names.includes('Verify Wf Switched Off') || names.includes('Verify Wf Foreign Item')) problems.push(`${who}: the pharmacy's product list must hold the active items of its own network only: HTTP ${r.status} ${JSON.stringify(names)}`);
        }
        for (const [who, tok] of [['pharmacist of another network', otherPharmacist.token], ['stranger', stranger.token], ['unbooked vet', unbookedVet.token], ['farmer', farmer]]) {
          const r = await http('GET', `${apiBase}/pharmacies/${phA}/medications`, null, tok);
          if (r.status !== 403 || !plain(r)) problems.push(`${who} reading a pharmacy's product list must be refused in words (HTTP ${r.status}: ${msgOf(r).slice(0, 100)})`);
        }

        // the prescription the pharmacy sees
        const cowPh = await newCow('Verify Wf Pharmacy Cow');
        const phRx = await rx({ animalId: cowPh, medications: [line({ name: 'Verify Wf Match Me', withdrawalMilkDays: 3, withdrawalMeatDays: 10 })] });
        const phRxId = phRx.json?.data?.id;
        if (!phRxId) problems.push(`prescription for the pharmacy check: HTTP ${phRx.status} ${msgOf(phRx).slice(0, 100)}`);
        else sql(`UPDATE prescriptions SET network_id = '${net1}', review_status = 'pending_review' WHERE id = '${phRxId}';`);
        const lineOf = async (pharmacy, tok) => {
          const r = await http('GET', `${apiBase}/pharmacies/${pharmacy}/pending-prescriptions`, null, tok);
          const p = (Array.isArray(r.json) ? r.json : []).find(x => x.id === phRxId);
          return { r, line: (p?.medications || []).find(l => l.name === 'Verify Wf Match Me') };
        };
        const before = await lineOf(phA, pharmacist.token);
        if (before.r.status !== 200 || !before.line) problems.push(`the pharmacy queue must show the prescription (HTTP ${before.r.status})`);
        else if (before.line.stockMatch) problems.push('a line with no saved match must carry no stockMatch');

        const put = (pharmacy, body, tok) => http('PUT', `${apiBase}/pharmacies/${pharmacy}/line-matches`, body, tok);
        const m1 = await put(phA, { lineName: '  Verify Wf MATCH me ', medId }, pharmacist.token);
        if (m1.status !== 200) problems.push(`a pharmacist saving a match: HTTP ${m1.status} ${msgOf(m1).slice(0, 100)}`);
        const noRole = await put(phA, { lineName: 'Verify Wf Match Me', medId }, farmer);
        if (noRole.status !== 403 || !plain(noRole)) problems.push(`a farmer saving a pharmacy match must be refused in words (HTTP ${noRole.status}: ${msgOf(noRole).slice(0, 100)})`);
        const otherNet = await put(phA, { lineName: 'Verify Wf Match Me', medId }, otherPharmacist.token);
        if (otherNet.status !== 403 || !plain(otherNet)) problems.push(`a pharmacist of another network saving a match must be refused in words (HTTP ${otherNet.status}: ${msgOf(otherNet).slice(0, 100)})`);
        const foreignMed = await put(phA, { lineName: 'Verify Wf Match Me', medId: foreignId || uuid() }, pharmacist.token);
        if (foreignMed.status !== 404 || !plain(foreignMed)) problems.push(`a product of another network must be refused with 404 in words (HTTP ${foreignMed.status}: ${msgOf(foreignMed).slice(0, 120)})`);
        const notUuid = await put(phA, { lineName: 'Verify Wf Match Me', medId: 'not-a-uuid' }, pharmacist.token);
        if (notUuid.status !== 400 || !plain(notUuid)) problems.push(`a medId that is not an id must be refused with 400 in words (HTTP ${notUuid.status}: ${msgOf(notUuid).slice(0, 100)})`);
        const noName = await put(phA, { medId }, pharmacist.token);
        if (noName.status !== 400 || !plain(noName)) problems.push(`a match with no line name must be refused in words (HTTP ${noName.status})`);
        const nMatch = Number(rows(`SELECT COUNT(*) AS n FROM ${S}.pharmacy_line_matches WHERE pharmacy_id = '${phA}'`)[0]?.n);
        if (nMatch !== 1) problems.push(`exactly one saved match expected after the refusals, found ${nMatch}`);

        const after = await lineOf(phA, pharmacist.token);
        const sm = after.line?.stockMatch;
        if (!sm || sm.medId !== medId || sm.name !== 'Verify Wf Stock Item') problems.push(`the queue line must carry the saved match: ${JSON.stringify(sm)}`);
        else if (sm.differs !== true) problems.push(`label days differ (meat 7 vs the vet's 10) so differs must be true: ${JSON.stringify(sm)}`);
        const adminSees = await lineOf(phA, admin.token);
        if (!adminSees.line?.stockMatch) problems.push('admin does not see the same saved match');
        const sameLine = await lineOf(phB, pharmacist.token);
        if (sameLine.r.status !== 200 || sameLine.line?.stockMatch) problems.push(`another pharmacy of the same network must not see pharmacy A's match: HTTP ${sameLine.r.status} ${JSON.stringify(sameLine.line?.stockMatch)}`);
        const outsiderQueue = await http('GET', `${apiBase}/pharmacies/${phA}/pending-prescriptions`, null, otherPharmacist.token);
        if (outsiderQueue.status !== 403 || !plain(outsiderQueue)) problems.push(`a pharmacist of another network reading the queue must be refused in words (HTTP ${outsiderQueue.status})`);
        // same days -> differs false
        await http('PATCH', `${apiBase}/networks/${net1}/medications/${medId}`, { withdrawal_meat_days: 10 }, pharmacist.token);
        const same = (await lineOf(phA, pharmacist.token)).line?.stockMatch;
        if (!same || same.differs !== false) problems.push(`with the same label days differs must be false: ${JSON.stringify(same)}`);
        // forget the match
        const del = await put(phA, { lineName: 'Verify Wf Match Me', medId: null }, pharmacist.token);
        if (del.status !== 200 || (await lineOf(phA, pharmacist.token)).line?.stockMatch) problems.push(`forgetting a match: HTTP ${del.status}, the line still carries it`);
      }

      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (problems.length || sqlErrs.length) fail('The withdrawal follow-ups misbehave on the real schema.', [...problems, ...sqlErrs]);
      else ok('068 schema; course start day; one override row per confirmation; idempotent own treatment; timeline; bought-on; pharmacy kind, label days and line matches');
    }

    // ── PHASE 6k: herd prescriptions reach the pharmacy; every refusal carries its code and plain words (withdrawal ledger) ──
    if (serverHealthy && port) {
      step('PHASE 6k Herd prescription to the pharmacy and back to the farm; coded refusals');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 81000;
      const msgOf = (r) => r.json?.message || r.json?.error?.message || '';
      const codeOf = (r) => r.json?.error?.code || '';
      const plain = (r) => { const m = msgOf(r); return m.length >= 12 && !/status code|\bHTTP\b|\b[45]\d\d\b|\bat .+\(|undefined|\[object|Error:|violates|syntax/i.test(m); };
      const sql = (q) => psql('verifydb', `SET search_path TO ${SCHEMA}, public; ${q}`);
      const rows = (q) => psqlJson('verifydb', q);
      const S = SCHEMA;
      const uuid = () => require('crypto').randomUUID();
      const signUp = async (role, dbRole) => {
        const email = `verify.hd.${role}.${Date.now()}.${seq}@example.com`;
        const body = { firstName: 'Hd', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`, password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-6K';
        await http('POST', `${apiBase}/auth/register`, body);
        if (dbRole || role === 'veterinarian') sql(`UPDATE users SET ${dbRole ? `role = '${dbRole}', ` : ''}account_status = 'active', is_active = true WHERE email = '${email}';`);
        const login = await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' });
        return { token: login.json?.data?.token, id: login.json?.data?.user?.id };
      };
      // One refusal: the HTTP status, the stable code, the words (no codes in them) and, where asked, the params.
      const coded = (label, r, status, code, params) => {
        if (r.status !== status || codeOf(r) !== code) { problems.push(`${label}: expected HTTP ${status} with code ${code}, got HTTP ${r.status} with code '${codeOf(r)}' (${msgOf(r).slice(0, 110)})`); return; }
        if (!plain(r)) problems.push(`${label}: code ${code} came back without plain words: '${msgOf(r).slice(0, 110)}'`);
        for (const [k, v] of Object.entries(params || {})) if (r.json?.error?.params?.[k] !== v) problems.push(`${label}: error.params.${k} should be '${v}', got ${JSON.stringify(r.json?.error?.params)}`);
      };
      const admin = await signUp('pet_owner', 'admin');
      const stranger = await signUp('pet_owner');
      const worker = await signUp('pet_owner');
      const viewer = await signUp('pet_owner');
      const unbookedVet = await signUp('veterinarian');
      const bookedVet = await signUp('veterinarian');
      const pharmacist = await signUp('pet_owner', 'pharmacist');
      const otherPharmacist = await signUp('pet_owner', 'pharmacist');
      const farmerLogin = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
      const farmer = farmerLogin.json?.data?.token;
      const tomId = farmerLogin.json?.data?.user?.id;
      let ent = null;
      try { ent = rows(`SELECT e.id FROM ${S}.enterprises e JOIN ${S}.users u ON u.id = e.owner_id WHERE u.email = 'tom.wilson@example.com' ORDER BY e.created_at LIMIT 1`)[0]?.id; } catch { /* reported below */ }
      if ([admin, stranger, worker, viewer, unbookedVet, bookedVet, pharmacist, otherPharmacist].some(u => !u.token || !u.id) || !farmer || !tomId || !ent) problems.push('could not set up the accounts and the seeded farm for the herd-to-pharmacy journey');
      else {
        const rx = (body, tok = admin.token) => http('POST', `${apiBase}/prescriptions`, { petOwnerId: tomId, diagnosis: 'Verify', instructions: '', ...body }, tok);
        const line = (extra) => ({ name: 'Verify Hd Product', dosage: '5 ml', frequency: 'Once daily', treatmentDays: 2, withdrawalMilkDays: 3, withdrawalMeatDays: 10, ...extra });
        const newCow = async (name) => (await http('POST', `${apiBase}/animals`, { name, species: 'Cattle', gender: 'female', enterpriseId: ent }, farmer)).json?.data?.id;
        let slotN = 0; // a vet has one booking per start time
        const book = (who, subjectCol, subjectId) => { const m = 8 * 60 + 5 * slotN++; const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); sql(`INSERT INTO bookings (pet_owner_id, veterinarian_id, ${subjectCol}, enterprise_id, scheduled_date, time_slot_start, time_slot_end, status) VALUES ('${tomId}', '${who}', '${subjectId}', '${ent}', CURRENT_DATE, '${t}', '23:59', 'confirmed');`); };
        sql(`INSERT INTO enterprise_members (enterprise_id, user_id, role) VALUES ('${ent}', '${worker.id}', 'worker'), ('${ent}', '${viewer.id}', 'viewer') ON CONFLICT DO NOTHING;`);

        // fixtures: a herd (batch mode), a network with a primary pharmacy and a pharmacist, another network with its own pharmacist
        const herdName = `Verify Hd Herd ${Date.now()}`;
        const g = await http('POST', `${apiBase}/animal-groups`, { enterpriseId: ent, name: herdName, groupType: 'herd', species: 'Cattle', managementMode: 'batch', targetCount: 40 }, farmer);
        let herd = g.json?.data?.id || g.json?.data?.group?.id || null;
        if (!herd) herd = rows(`SELECT id FROM ${S}.animal_groups WHERE name = '${herdName}'`)[0]?.id || null;
        if (!herd) problems.push(`could not create the herd for the journey: HTTP ${g.status} ${msgOf(g).slice(0, 120)}`);
        const net1 = uuid(); const net2 = uuid(); const phA = uuid(); const phC = uuid();
        sql(`INSERT INTO hospital_networks (id, name) VALUES ('${net1}', 'Verify Hd Network One'), ('${net2}', 'Verify Hd Network Two');
             INSERT INTO hospital_pharmacies (id, network_id, pharmacy_name, is_primary_pharmacy) VALUES ('${phA}', '${net1}', 'Verify Hd Pharmacy A', true), ('${phC}', '${net2}', 'Verify Hd Pharmacy C', true);
             INSERT INTO hospital_network_members (network_id, user_id, network_role) VALUES ('${net1}', '${pharmacist.id}', 'hospital_staff'), ('${net2}', '${otherPharmacist.id}', 'hospital_staff');`);

        // ── 1. Herd prescription -> the pharmacy ──
        if (herd) {
          sql(`UPDATE animal_groups SET current_count = 40 WHERE id = '${herd}';`);
          const unbookedRx = await rx({ groupId: herd, networkId: net1, medications: [line({ name: 'Verify Hd Nope' })] }, unbookedVet.token);
          coded('an unbooked vet prescribing for the herd', unbookedRx, 403, 'RX_GROUP_NOT_BOOKED');
          book(bookedVet.id, 'group_id', herd);
          const rxCount = () => Number(rows(`SELECT COUNT(*) AS n FROM ${S}.prescriptions WHERE group_id = '${herd}'`)[0]?.n);
          const rxBefore = rxCount();
          coded('a booked vet who is not a member of the network sending a herd prescription to its pharmacy', await rx({ groupId: herd, networkId: net1, medications: [line({ name: 'Verify Hd Outsider' })] }, bookedVet.token), 403, 'RX_NETWORK_NOT_MEMBER');
          if (rxCount() !== rxBefore) problems.push('a refused non-member vet still created a prescription row');
          sql(`INSERT INTO hospital_network_members (network_id, user_id, network_role) VALUES ('${net1}', '${bookedVet.id}', 'hospital_staff');`);
          const herdLine = 'Verify Hd Herd Feed';
          const herdRx = await rx({ groupId: herd, networkId: net1, medications: [line({ name: herdLine, kind: 'medicated_feed', dosage: '100 g/head', treatmentDays: 5, withdrawalMilkDays: 2, withdrawalMeatDays: 7 })] }, bookedVet.token);
          const herdRxId = herdRx.json?.data?.id;
          if (herdRx.status !== 201 || !herdRxId) problems.push(`the booked vet's herd prescription for a network: HTTP ${herdRx.status} ${msgOf(herdRx).slice(0, 140)}`);
          else {
            let row = rows(`SELECT network_id, is_network_coordinated, target_pharmacy_id, review_status FROM ${S}.prescriptions WHERE id = '${herdRxId}'`)[0] || {};
            if (row.network_id !== net1 || row.is_network_coordinated !== true || row.target_pharmacy_id !== phA || row.review_status !== 'pending_review') {
              problems.push(`a herd prescription sent with networkId must be network-coordinated to the primary pharmacy, but the row is ${JSON.stringify(row)} `);
            }
            // a cow prescription in the same queue (regression)
            const cow = await newCow('Verify Hd Queue Cow');
            const cowRx = await rx({ animalId: cow, networkId: net1, medications: [line({ name: 'Verify Hd Cow Drug' })] });
            const cowRxId = cowRx.json?.data?.id;
            if (!cowRxId) problems.push(`the cow prescription for the queue: HTTP ${cowRx.status} ${msgOf(cowRx).slice(0, 120)}`);
            else {
              row = rows(`SELECT network_id, review_status FROM ${S}.prescriptions WHERE id = '${cowRxId}'`)[0] || {};
              if (row.network_id !== net1 || row.review_status !== 'pending_review') {
                problems.push(`an animal prescription sent with networkId must reach the pharmacy queue, but the row is ${JSON.stringify(row)}`);
              }
            }
            const queueOf = async (pharmacy, tok, path = 'pending-prescriptions') => http('GET', `${apiBase}/pharmacies/${pharmacy}/${path}`, null, tok);
            const find = (r, id) => (Array.isArray(r.json) ? r.json : []).find(x => x.id === id);
            const herdRow = (r) => {
              const p = find(r, herdRxId);
              if (!p) return 'the herd prescription is not in the list';
              if (p.pet_name !== herdName) return `pet_name is '${p.pet_name}', expected the herd's name '${herdName}'`;
              if (p.is_group !== true) return `is_group is ${p.is_group}, expected true`;
              if (Number(p.head_count_treated) !== 40) return `head_count_treated is ${p.head_count_treated}, expected 40`;
              if (p.animal_species !== 'Cattle') return `animal_species is '${p.animal_species}', expected the herd's species Cattle`;
              return '';
            };
            for (const [who, tok] of [['pharmacist', pharmacist.token], ['admin', admin.token]]) {
              const r = await queueOf(phA, tok);
              const bad = r.status !== 200 ? `HTTP ${r.status}` : herdRow(r);
              if (bad) problems.push(`${who} reading the pharmacy queue: ${bad}`);
              const c = find(r, cowRxId);
              if (cowRxId && (!c || c.is_group !== false || c.pet_name !== 'Verify Hd Queue Cow' || c.animal_species !== 'Cattle')) problems.push(`${who}: the animal prescription must still list as before (is_group false, its own name and species): ${JSON.stringify(c && { n: c.pet_name, g: c.is_group, s: c.animal_species })}`);
            }
            for (const [who, tok] of [['pharmacist of another network', otherPharmacist.token], ['stranger', stranger.token], ['farm owner', farmer], ['unbooked vet', unbookedVet.token]]) {
              for (const path of ['pending-prescriptions', 'ready-for-dispensing', 'dispensing-history', 'medications']) {
                const r = await queueOf(phA, tok, path);
                if (r.status !== 403 || !plain(r)) problems.push(`${who} reading the pharmacy's ${path} must be refused in words (HTTP ${r.status}: ${msgOf(r).slice(0, 100)})`);
                if (r.status === 200 && JSON.stringify(r.json).includes(herdName)) problems.push(`${who} was shown the herd's name in the pharmacy's ${path}`);
              }
            }
            // The prescribing vet is now an active MEMBER of the network, so the existing membership rule lets them read its pharmacy
            // queue (unchanged by this work): a vet who is not a member (the unbooked vet above) is refused.
            const memberVetQueue = await queueOf(phA, bookedVet.token);
            if (memberVetQueue.status !== 200) problems.push(`a vet who is a member of the network reads its pharmacy queue as before (HTTP ${memberVetQueue.status})`);
            const ownQueue = await queueOf(phC, otherPharmacist.token);
            if (ownQueue.status !== 200 || find(ownQueue, herdRxId)) problems.push(`the other network's own queue must not hold the herd prescription (HTTP ${ownQueue.status})`);

            // a match, saved by the pharmacist, shows on the herd line
            const med = await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Hd Stock Feed', product_kind: 'medicine', withdrawal_milk_days: 2, withdrawal_meat_days: 7 }, pharmacist.token);
            const medId = med.json?.id;
            if (!medId) problems.push(`adding the stock item: HTTP ${med.status} ${JSON.stringify(med.json || {}).slice(0, 120)}`);
            else {
              const m = await http('PUT', `${apiBase}/pharmacies/${phA}/line-matches`, { lineName: herdLine, medId }, pharmacist.token);
              if (m.status !== 200) problems.push(`saving a match for the herd's line: HTTP ${m.status} ${msgOf(m).slice(0, 100)}`);
              const sm = find(await queueOf(phA, pharmacist.token), herdRxId)?.medications?.find(l => l.name === herdLine)?.stockMatch;
              if (!sm || sm.medId !== medId || sm.differs !== false) problems.push(`the herd's line must carry stockMatch (same label days so differs false): ${JSON.stringify(sm)}`);
            }

            // review -> ready for dispensing -> dispense -> history -> the farm's "bought on"
            for (const [who, tok] of [['farm owner', farmer], ['stranger', stranger.token], ['pharmacist of another network', otherPharmacist.token]]) {
              const r = await http('POST', `${apiBase}/prescriptions/${herdRxId}/review`, { review_status: 'approved' }, tok);
              if (r.status !== 403) problems.push(`${who} approving the herd prescription must be refused (HTTP ${r.status}: ${msgOf(r).slice(0, 100)})`);
            }
            const rev = await http('POST', `${apiBase}/prescriptions/${herdRxId}/review`, { review_status: 'approved' }, pharmacist.token);
            if (rev.status !== 200 || rev.json?.review_status !== 'approved_for_dispensing') problems.push(`approving the herd prescription: HTTP ${rev.status} ${JSON.stringify(rev.json || {}).slice(0, 120)}`);
            if (cowRxId) await http('POST', `${apiBase}/prescriptions/${cowRxId}/review`, { review_status: 'approved' }, pharmacist.token);
            const stillPending = find(await queueOf(phA, pharmacist.token), herdRxId);
            if (stillPending) problems.push('an approved herd prescription is still in the pending queue');
            const ready = await queueOf(phA, pharmacist.token, 'ready-for-dispensing');
            const rp = find(ready, herdRxId);
            if (ready.status !== 200 || !rp || rp.pet_name !== herdName || rp.is_group !== true || Number(rp.head_count_treated) !== 40) problems.push(`the ready-for-dispensing list must show the herd (name, is_group true, 40 head): HTTP ${ready.status} ${JSON.stringify(rp && { n: rp.pet_name, g: rp.is_group, h: rp.head_count_treated })}`);
            const rc = find(ready, cowRxId);
            if (cowRxId && (!rc || rc.is_group !== false || rc.pet_name !== 'Verify Hd Queue Cow')) problems.push('the cow prescription must still list as an animal in ready-for-dispensing');

            const histOf = async (tok) => ((await http('GET', `${apiBase}/enterprises/${ent}/treatments`, null, tok)).json?.data?.history || []).find(h => h.medicine === herdLine && h.source === 'prescription');
            const beforeBuy = await histOf(farmer);
            if (!beforeBuy || beforeBuy.groupId !== herd || beforeBuy.boughtOn !== null) problems.push(`before dispensing the farm's history row for the herd must carry groupId and boughtOn null: ${JSON.stringify(beforeBuy && { g: beforeBuy.groupId, b: beforeBuy.boughtOn })}`);
            const disp = await http('POST', `${apiBase}/dispensing`, { prescription_id: herdRxId, pharmacy_id: phA, dispensing_method: 'walk_in_pickup', line_items: [] }, pharmacist.token);
            const dispId = disp.json?.id;
            if (disp.status !== 201 || !dispId) problems.push(`dispensing the herd prescription: HTTP ${disp.status} ${JSON.stringify(disp.json || {}).slice(0, 140)}`);
            else {
              const strangerDisp = await http('POST', `${apiBase}/dispensing`, { prescription_id: herdRxId, pharmacy_id: phA }, otherPharmacist.token);
              if (strangerDisp.status !== 403 || !plain(strangerDisp)) problems.push(`a pharmacist of another network dispensing in pharmacy A must be refused in words (HTTP ${strangerDisp.status})`);
              if (rows(`SELECT review_status FROM ${S}.prescriptions WHERE id = '${herdRxId}'`)[0]?.review_status !== 'dispensed') problems.push('dispensing did not mark the herd prescription dispensed');
              const prepared = await histOf(farmer);
              if (prepared?.boughtOn) problems.push(`a dispensing that is not handed over must not set boughtOn (got ${prepared.boughtOn})`);
              const handed = await http('PATCH', `${apiBase}/dispensing/${dispId}`, { dispensing_status: 'handed_over', received_by: 'Verify Hd Farmer' }, pharmacist.token);
              if (handed.status !== 200) problems.push(`marking the herd's medicine handed over: HTTP ${handed.status}`);
              const hist = await http('GET', `${apiBase}/pharmacies/${phA}/dispensing-history`, null, pharmacist.token);
              const h = (Array.isArray(hist.json) ? hist.json : []).find(x => x.id === dispId);
              if (hist.status !== 200 || !h || h.animal_name !== herdName || h.is_group !== true) problems.push(`dispensing-history must show the herd's name with is_group true: HTTP ${hist.status} ${JSON.stringify(h && { n: h.animal_name, g: h.is_group })}`);
              for (const [who, tok] of [['farm owner', farmer], ['farm worker', worker.token], ['farm viewer', viewer.token], ['admin', admin.token]]) {
                const b = await histOf(tok);
                if (!b || ![iso(-1), iso(0), iso(1)].includes(b.boughtOn)) problems.push(`${who}: after hand-over the farm's history row must carry boughtOn = today, got ${JSON.stringify(b?.boughtOn)}`);
                else if (b.groupId !== herd || b.name !== herdName) problems.push(`${who}: the history row must name the herd (${herdName}), got '${b.name}'`);
              }
              const hs = (await http('GET', `${apiBase}/animal-groups/${herd}/withdrawal`, null, farmer)).json?.data;
              if (hs?.meatUntil !== iso(11)) problems.push(`the herd's meat withdrawal must still run to ${iso(11)} after buying the medicine (got ${hs?.meatUntil})`);
              for (const [who, tok] of [['stranger', stranger.token], ['unbooked vet', unbookedVet.token]]) {
                const r = await http('GET', `${apiBase}/enterprises/${ent}/treatments`, null, tok);
                if (r.status !== 403 || !plain(r)) problems.push(`${who} reading the farm's treatments must be refused in words (HTTP ${r.status})`);
              }
            }
            // the cow still dispenses as before
            if (cowRxId) {
              const cd = await http('POST', `${apiBase}/dispensing`, { prescription_id: cowRxId, pharmacy_id: phA, dispensing_method: 'walk_in_pickup', line_items: [] }, pharmacist.token);
              const ch = (await http('GET', `${apiBase}/pharmacies/${phA}/dispensing-history`, null, pharmacist.token)).json;
              const chRow = (Array.isArray(ch) ? ch : []).find(x => x.id === cd.json?.id);
              if (cd.status !== 201 || !chRow || chRow.animal_name !== 'Verify Hd Queue Cow' || chRow.is_group !== false) problems.push(`the cow's dispensing must still read as an animal: HTTP ${cd.status} ${JSON.stringify(chRow && { n: chRow.animal_name, g: chRow.is_group })}`);
            }
          }
        }

        // ── 2. Coded refusals ──
        const cowA = await newCow('Verify Hd Refusal Cow');
        const dog = (await http('POST', `${apiBase}/animals`, { name: 'Verify Hd Dog', species: 'Dog', gender: 'male' }, stranger.token)).json?.data?.id;
        if (!cowA || !dog) problems.push('could not add the cow and the other farm\'s pet for the refusal checks');
        else {
          book(bookedVet.id, 'animal_id', cowA);
          coded('a cow medicine with no label days', await rx({ animalId: cowA, medications: [line({ name: 'Verify Hd Label', withdrawalMilkDays: undefined, withdrawalMeatDays: undefined })] }), 400, 'RX_LABEL_DAYS_REQUIRED', { label: 'Verify Hd Label' });
          coded('a cow medicine with no treatment days', await rx({ animalId: cowA, medications: [line({ name: 'Verify Hd Days', treatmentDays: undefined })] }), 400, 'RX_TREATMENT_DAYS_REQUIRED', { label: 'Verify Hd Days' });
          coded('a prescription for an animal and a herd at once', await rx({ animalId: cowA, groupId: herd || uuid(), medications: [line()] }), 400, 'RX_ONE_SUBJECT');
          coded('a course that started 60 days ago', await rx({ animalId: cowA, courseStartOn: iso(-60), medications: [line()] }), 400, 'RX_START_RANGE');

          const own = (extra) => http('POST', `${apiBase}/enterprises/${ent}/treatments`, { animalId: cowA, medicineName: 'Verify Hd Own', treatmentDays: 1, withdrawalMilkDays: 0, withdrawalMeatDays: 0, ...extra }, farmer);
          coded('the farmer\'s treatment with no label days', await own({ withdrawalMilkDays: undefined, withdrawalMeatDays: undefined }), 400, 'WD_LABEL_DAYS_REQUIRED');
          coded('the farmer\'s treatment with an empty medicine name', await own({ medicineName: '   ' }), 400, 'WD_NAME_REQUIRED');
          coded('the farmer treatment with no treatment days', await own({ treatmentDays: undefined }), 400, 'WD_DAYS_REQUIRED');
          coded('the farmer treatment with label days left empty', await own({ withdrawalMilkDays: null, withdrawalMeatDays: '' }), 400, 'WD_LABEL_DAYS_REQUIRED');
          coded('the farmer\'s treatment for another farm\'s animal', await own({ animalId: dog }), 400, 'WD_SUBJECT_NOT_ON_FARM');
          coded('the farmer\'s treatment starting in the future', await own({ startedOn: iso(5) }), 400, 'WD_START_IN_FUTURE');
          if (Number(rows(`SELECT COUNT(*) AS n FROM ${S}.self_treatments WHERE medicine_name = 'Verify Hd Own'`)[0]?.n) !== 0) problems.push('a refused treatment still created a row');

          const tid = uuid();
          const saved = await own({ id: tid, startedOn: iso(-2) });
          if (saved.status !== 201) problems.push(`the farmer's own treatment for the course checks: HTTP ${saved.status} ${msgOf(saved).slice(0, 100)}`);
          else coded('a last dose before the treatment started', await http('PATCH', `${apiBase}/treatments/self/${tid}/course`, { lastDoseOn: iso(-10) }, farmer), 400, 'WD_LAST_DOSE_BEFORE_START');
          coded('correcting a treatment that does not exist', await http('PATCH', `${apiBase}/treatments/self/${uuid()}/course`, { lastDoseOn: iso(0) }, farmer), 404, 'WD_NOT_FOUND');

          const courseRx = await rx({ animalId: cowA, medications: [line({ name: 'Verify Hd Course' })] });
          if (!courseRx.json?.data?.id) problems.push(`the prescription for the booked-vet check: HTTP ${courseRx.status} ${msgOf(courseRx).slice(0, 100)}`);
          else {
            const vetFix = await http('PATCH', `${apiBase}/treatments/prescriptions/${courseRx.json.data.id}/course`, { lastDoseOn: iso(0) }, bookedVet.token);
            coded('a booked vet correcting the farm course', vetFix, 403, 'WD_FARM_TEAM_ONLY');
            const wdAfter = (await http('GET', `${apiBase}/animals/${cowA}/withdrawal`, null, farmer)).json?.data;
            if (wdAfter?.milkUntil !== iso(4)) problems.push(`the refused vet changed the withdrawal (milk until ${wdAfter?.milkUntil}, expected ${iso(4)})`);
          }

          // the pharmacy's own refusals
          const farmerMatch = await http('PUT', `${apiBase}/pharmacies/${phA}/line-matches`, { lineName: 'Verify Hd Label', medId: uuid() }, farmer);
          coded('a farmer saving a pharmacy match', farmerMatch, 403, 'FORBIDDEN_ROLE');
          coded('a product with an unknown kind', await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Hd Bad Kind', product_kind: 'bad' }, pharmacist.token), 400, 'PH_KIND_INVALID');
          coded('a product with -1 withdrawal days', await http('POST', `${apiBase}/networks/${net1}/medications`, { name: 'Verify Hd Bad Days', withdrawal_meat_days: -1 }, pharmacist.token), 400, 'PH_DAYS_INVALID');
          coded('a match with no line name', await http('PUT', `${apiBase}/pharmacies/${phA}/line-matches`, { lineName: '', medId: uuid() }, pharmacist.token), 400, 'PH_LINE_REQUIRED');
          coded('a match with a product that is not an id', await http('PUT', `${apiBase}/pharmacies/${phA}/line-matches`, { lineName: 'Verify Hd Label', medId: 'x' }, pharmacist.token), 400, 'PH_PRODUCT_INVALID');
          const other = await http('POST', `${apiBase}/networks/${net2}/medications`, { name: 'Verify Hd Foreign Item' }, otherPharmacist.token);
          coded('a match with another network\'s product', await http('PUT', `${apiBase}/pharmacies/${phA}/line-matches`, { lineName: 'Verify Hd Label', medId: other.json?.id || uuid() }, pharmacist.token), 404, 'PH_PRODUCT_MISSING');
          if (Number(rows(`SELECT COUNT(*) AS n FROM ${S}.pharmacy_medications WHERE name LIKE 'Verify Hd Bad%'`)[0]?.n) !== 0) problems.push('a refused product was still saved');

          // the 409 "record anyway" answer keeps its params
          const milkRx = await rx({ animalId: cowA, medications: [line({ name: 'Verify Hd Milk Drug' })] });
          if (milkRx.status !== 201) problems.push(`the prescription for the confirm check: HTTP ${milkRx.status}`);
          const ask = await http('POST', `${apiBase}/farm-records`, { enterpriseId: ent, animalId: cowA, recordType: 'milk', session: 'am', quantity: 5 }, farmer);
          coded('milk from an animal under withdrawal', ask, 409, 'WITHDRAWAL_CONFIRM', { what: 'milk', action: 'milk_entry', group: false });
          const pr = ask.json?.error?.params;
          if (!pr || !pr.name || !/^\d{4}-\d{2}-\d{2}$/.test(pr.until || '')) problems.push(`the 409 answer must carry name and until in error.params: ${JSON.stringify(pr)}`);
        }
      }
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (problems.length || sqlErrs.length) fail('The herd-to-pharmacy journey or a coded refusal misbehaves.', [...problems, ...sqlErrs]);
      else ok('herd prescription reaches the pharmacy queue, review, dispensing, history and the farm\'s bought-on; every refusal carries its code and plain words');
    }

    // ── PHASE 6l: hospital-network follow-ups - walk-in invite acceptance, patient transfers, pharmacist review shown to the vet,
    //    seat limit + removed routes, my plan and plan removal (owner-approved network zone, 2026-11-25) ──
    if (serverHealthy && port) {
      step('PHASE 6l Hospital network: walk-in invite, patient transfer, pharmacist review, seat limit, my plan');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 82000;
      const msgOf = (r) => r.json?.message || r.json?.error?.message || (typeof r.json?.error === 'string' ? r.json.error : '') || '';
      const codeOf = (r) => r.json?.error?.code || '';
      const plain = (r) => { const m = msgOf(r); return m.length >= 12 && !/status code|\bHTTP\b|\b[45]\d\d\b|\bat .+\(|undefined|\[object|Error:|violates|syntax/i.test(m); };
      const sql = (q) => psql('verifydb', `SET search_path TO ${SCHEMA}, public; ${q}`);
      const rows = (q) => psqlJson('verifydb', q);
      const S = SCHEMA;
      const uuid = () => require('crypto').randomUUID();
      const n = (q) => Number(rows(q)[0]?.n);
      const notes = [];
      const signUp = async (role, dbRole) => {
        const email = `verify.hn.${role}.${Date.now()}.${seq}@example.com`;
        const body = { firstName: 'Hn', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`, password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-6L';
        await http('POST', `${apiBase}/auth/register`, body);
        if (dbRole || role === 'veterinarian') sql(`UPDATE users SET ${dbRole ? `role = '${dbRole}', ` : ''}account_status = 'active', is_active = true WHERE email = '${email}';`);
        const login = await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' });
        return { token: login.json?.data?.token, id: login.json?.data?.user?.id, email };
      };
      // one refusal: HTTP status, stable code, plain words, optional params
      const coded = (label, r, status, code, params) => {
        if (r.status !== status || codeOf(r) !== code) { problems.push(`${label}: expected HTTP ${status} with code ${code}, got HTTP ${r.status} with code '${codeOf(r)}' (${msgOf(r).slice(0, 110)})`); return; }
        if (!plain(r)) problems.push(`${label}: code ${code} came back without plain words: '${msgOf(r).slice(0, 110)}'`);
        for (const [k, v] of Object.entries(params || {})) if (r.json?.error?.params?.[k] !== v) problems.push(`${label}: error.params.${k} should be '${v}', got ${JSON.stringify(r.json?.error?.params)}`);
      };
      // a refusal in words with only the status asserted (older routes with no code)
      const refused = (label, r, statuses) => {
        if (!statuses.includes(r.status)) { problems.push(`${label}: expected HTTP ${statuses.join(' or ')}, got HTTP ${r.status} (${msgOf(r).slice(0, 110)})`); return; }
        if (!plain(r)) problems.push(`${label}: refused (HTTP ${r.status}) without plain words: '${msgOf(r).slice(0, 110)}'`);
        else if (msgOf(r).length < 25) notes.push(`${label}: wording is very short ('${msgOf(r)}')`);
      };
      const notifOf = (userId, type, extra = '') => rows(`SELECT id FROM ${S}.notifications WHERE user_id = '${userId}' AND (type = '${type}' OR metadata->>'type' = '${type}') ${extra}`);

      const admin = await signUp('pet_owner', 'admin');
      const corp = await signUp('pet_owner', 'corporate_admin');
      const corp2 = await signUp('pet_owner', 'corporate_admin');
      const director = await signUp('pet_owner', 'hospital_staff');
      const auditor = await signUp('pet_owner', 'hospital_staff');
      const pharmacist = await signUp('pet_owner', 'pharmacist');
      const ownerP = await signUp('pet_owner');
      const stranger = await signUp('pet_owner');
      const rxVet = await signUp('veterinarian');
      const otherVet = await signUp('veterinarian');
      const who = { admin, corp, corp2, director, auditor, pharmacist, ownerP, stranger, rxVet, otherVet };
      if (Object.values(who).some(u => !u.token || !u.id)) problems.push(`could not set up the accounts for the hospital-network journeys (missing: ${Object.entries(who).filter(([, u]) => !u.token || !u.id).map(([k]) => k).join(', ')})`);
      else {
        // fixtures: two networks, hospitals A and B (net1), D (net2), X (in no network); members; a plan and a subscription
        const net1 = uuid(); const net2 = uuid(); const hA = uuid(); const hB = uuid(); const hD = uuid(); const hX = uuid();
        const planUsed = uuid(); const planFree = uuid();
        const planUsedName = `Verify Hn Plan In Use ${Date.now()}`; const planFreeName = `Verify Hn Plan Unused ${Date.now()}`;
        sql(`INSERT INTO hospital_networks (id, name) VALUES ('${net1}', 'Verify Hn Network One'), ('${net2}', 'Verify Hn Network Two');
             INSERT INTO vet_hospitals (id, name, owner_id) VALUES ('${hA}', 'Verify Hn Hospital A', '${admin.id}'), ('${hB}', 'Verify Hn Hospital B', '${admin.id}'),
                 ('${hD}', 'Verify Hn Hospital D', '${admin.id}'), ('${hX}', 'Verify Hn Hospital X', '${admin.id}');
             INSERT INTO hospital_network_hospitals (network_id, hospital_id) VALUES ('${net1}', '${hA}'), ('${net1}', '${hB}'), ('${net2}', '${hD}');
             INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id) VALUES
                 ('${net1}', '${corp.id}', 'corporate_admin', NULL), ('${net1}', '${director.id}', 'hospital_director', '${hA}'),
                 ('${net1}', '${auditor.id}', 'auditor', NULL), ('${net1}', '${pharmacist.id}', 'hospital_staff', '${hA}'),
                 ('${net1}', '${rxVet.id}', 'hospital_staff', '${hA}'), ('${net2}', '${corp2.id}', 'corporate_admin', NULL);
             INSERT INTO network_subscription_plans (id, name, max_seats, price_monthly, price_annually, is_published, is_active) VALUES
                 ('${planUsed}', '${planUsedName}', 20, 99.00, 990.00, true, true), ('${planFree}', '${planFreeName}', 10, 49.00, 490.00, true, true);
             INSERT INTO network_subscriptions (network_id, plan_id, seat_limit, status) VALUES ('${net1}', '${planUsed}', 50, 'active');`);
        const memberCount = () => n(`SELECT COUNT(*) AS n FROM ${S}.hospital_network_members WHERE network_id = '${net1}' AND is_active = true AND (valid_until IS NULL OR valid_until > NOW())`);

        // ── 1. Walk-in invite ──
        const ctxBefore = n(`SELECT COUNT(*) AS n FROM ${S}.animal_care_contexts`);
        const consentBefore = n(`SELECT COUNT(*) AS n FROM ${S}.patient_data_consent`);
        const invite = async (extra = {}, tok = corp.token) => http('POST', `${apiBase}/hospital-networks/${net1}/invite-walkin`,
          { patientName: 'Hn Verify', patientEmail: ownerP.email, animalName: 'Verify Hn Walkin Dog', animalSpecies: 'Dog', hospitalId: hA, ...extra }, tok);
        const inv = await invite();
        const tok1 = inv.json?.data?.inviteToken;
        if (inv.status !== 200 || !tok1) problems.push(`a network member creating a walk-in invitation: HTTP ${inv.status} ${msgOf(inv).slice(0, 120)}`);
        else {
          if (!String(inv.json.data.inviteUrl || '').endsWith(`/accept-walkin-invite?token=${tok1}`)) problems.push(`the invitation link must end in /accept-walkin-invite?token=<token>, got '${inv.json.data.inviteUrl}'`);
          refused('a network auditor (no walk-in registration right) creating an invitation', await invite({}, auditor.token), [403]);
          refused('a stranger creating an invitation for a network they are not in', await invite({}, stranger.token), [403, 404]);
          const mine = await http('GET', `${apiBase}/hospital-networks/walkin-invites/mine`, null, ownerP.token);
          const mi = (mine.json?.data?.items || []).find(i => i.token === tok1);
          if (mine.status !== 200 || !mi) problems.push(`the invited pet owner's own list must hold the invitation: HTTP ${mine.status} ${JSON.stringify(mine.json || {}).slice(0, 120)}`);
          else {
            if (mi.networkName !== 'Verify Hn Network One') problems.push(`the invitation must name the network, got '${mi.networkName}'`);
            if (mi.animalName !== 'Verify Hn Walkin Dog') problems.push(`the invitation must name the pet, got '${mi.animalName}'`);
            if (mi.inviterName !== 'Hn Verify') problems.push(`the invitation must name who invited, got '${mi.inviterName}'`);
          }
          const other = await http('GET', `${apiBase}/hospital-networks/walkin-invites/mine`, null, stranger.token);
          if (other.status !== 200 || (other.json?.data?.items || []).length !== 0) problems.push(`a different signed-in user must see no invitations, got HTTP ${other.status} ${JSON.stringify(other.json || {}).slice(0, 120)}`);
          const prev = await http('GET', `${apiBase}/hospital-networks/walkin-invites/by-token/${tok1}`, null, stranger.token);
          if (prev.status !== 200 || prev.json?.data?.networkName !== 'Verify Hn Network One') problems.push(`the invitation behind its link must open for any signed-in user: HTTP ${prev.status}`);
          coded('opening an invitation link with an unknown token', await http('GET', `${apiBase}/hospital-networks/walkin-invites/by-token/${'0'.repeat(40)}`, null, ownerP.token), 404, 'WI_NOT_FOUND');
          coded('accepting with an unknown token', await http('POST', `${apiBase}/hospital-networks/walkin-invites/accept`, { token: '1'.repeat(40) }, ownerP.token), 404, 'WI_NOT_FOUND');
          const acc = await http('POST', `${apiBase}/hospital-networks/walkin-invites/accept`, { token: tok1 }, ownerP.token);
          if (acc.status !== 200) problems.push(`accepting a walk-in invitation: HTTP ${acc.status} ${msgOf(acc).slice(0, 120)}`);
          const row = rows(`SELECT status, accepted_by FROM ${S}.hospital_patient_invites WHERE invite_token = '${tok1}'`)[0] || {};
          if (row.status !== 'accepted' || row.accepted_by !== ownerP.id) problems.push(`after accepting, the invitation row must be accepted by the pet owner, got ${JSON.stringify(row)}`);
          if (n(`SELECT COUNT(*) AS n FROM ${S}.animal_care_contexts`) !== ctxBefore) problems.push('accepting a walk-in invitation created an enrolment (animal_care_contexts row); acceptance must share nothing');
          if (n(`SELECT COUNT(*) AS n FROM ${S}.patient_data_consent`) !== consentBefore) problems.push('accepting a walk-in invitation created a consent record; consent must be asked separately');
          if (notifOf(corp.id, 'walkin_invite_accepted').length < 1) problems.push('the inviter got no notification of type walkin_invite_accepted (checked the type column and metadata.type)');
          else if (rows(`SELECT type FROM ${S}.notifications WHERE user_id = '${corp.id}' AND metadata->>'type' = 'walkin_invite_accepted' LIMIT 1`)[0]?.type !== 'walkin_invite_accepted') notes.push("walkin_invite_accepted is stored in notifications.metadata.type; the notifications.type column holds 'system'");
          coded('accepting the same invitation again', await http('POST', `${apiBase}/hospital-networks/walkin-invites/accept`, { token: tok1 }, ownerP.token), 409, 'WI_USED');
          coded('opening an already accepted invitation', await http('GET', `${apiBase}/hospital-networks/walkin-invites/by-token/${tok1}`, null, ownerP.token), 409, 'WI_USED');
          const mineAfter = await http('GET', `${apiBase}/hospital-networks/walkin-invites/mine`, null, ownerP.token);
          if ((mineAfter.json?.data?.items || []).some(i => i.token === tok1)) problems.push('an accepted invitation still shows in the invited person\'s waiting list');
        }
        // expired
        const invE = await invite({ animalName: 'Verify Hn Expired Dog' });
        const tokE = invE.json?.data?.inviteToken;
        if (!tokE) problems.push(`creating the invitation to expire: HTTP ${invE.status}`);
        else {
          sql(`UPDATE hospital_patient_invites SET expires_at = NOW() - INTERVAL '1 hour' WHERE invite_token = '${tokE}';`);
          coded('opening an expired invitation', await http('GET', `${apiBase}/hospital-networks/walkin-invites/by-token/${tokE}`, null, ownerP.token), 410, 'WI_EXPIRED');
          coded('accepting an expired invitation', await http('POST', `${apiBase}/hospital-networks/walkin-invites/accept`, { token: tokE }, ownerP.token), 410, 'WI_EXPIRED');
          if (rows(`SELECT status FROM ${S}.hospital_patient_invites WHERE invite_token = '${tokE}'`)[0]?.status !== 'pending') problems.push('a refused expired acceptance changed the invitation status');
          if (((await http('GET', `${apiBase}/hospital-networks/walkin-invites/mine`, null, ownerP.token)).json?.data?.items || []).some(i => i.token === tokE)) problems.push('an expired invitation still shows in the waiting list');
        }
        // two taps at once: exactly one winner
        const invP = await invite({ animalName: 'Verify Hn Parallel Dog' });
        const tokP = invP.json?.data?.inviteToken;
        if (!tokP) problems.push(`creating the invitation for the parallel accept: HTTP ${invP.status}`);
        else {
          const both = await Promise.all([ownerP.token, stranger.token].map(t => http('POST', `${apiBase}/hospital-networks/walkin-invites/accept`, { token: tokP }, t)));
          const wins = both.filter(r => r.status === 200).length;
          if (wins !== 1) problems.push(`two parallel accepts of one invitation must give exactly one success, got statuses ${both.map(r => r.status).join(' and ')}`);
          const loser = both.find(r => r.status !== 200);
          if (loser && (loser.status !== 409 || codeOf(loser) !== 'WI_USED')) problems.push(`the losing parallel accept must be 409 WI_USED, got HTTP ${loser.status} '${codeOf(loser)}'`);
        }

        // ── 2. Patient transfer ──
        const dogA = (await http('POST', `${apiBase}/animals`, { name: 'Verify Hn Patient A', species: 'Dog', gender: 'male' }, ownerP.token)).json?.data?.id;
        const dogN2 = (await http('POST', `${apiBase}/animals`, { name: 'Verify Hn Other Net Dog', species: 'Dog', gender: 'male' }, ownerP.token)).json?.data?.id;
        const dogNone = (await http('POST', `${apiBase}/animals`, { name: 'Verify Hn Unenrolled Dog', species: 'Dog', gender: 'male' }, ownerP.token)).json?.data?.id;
        if (!dogA || !dogN2 || !dogNone) problems.push('could not add the three animals for the transfer journey');
        else {
          const ctx = (animal, net, hosp) => sql(`INSERT INTO animal_care_contexts (animal_id, network_id, hospital_id, is_active, enrollment_status, visibility) VALUES ('${animal}', '${net}', '${hosp}', true, 'active', 'network_only');`);
          ctx(dogA, net1, hA); ctx(dogN2, net2, hD);
          const post = (b, tok = director.token) => http('POST', `${apiBase}/hospital-networks/${net1}/patient-transfers`, { fromHospitalId: hA, toHospitalId: hB, animalId: dogA, reason: 'Verify Hn needs surgery at B', ...b }, tok);
          const refCount = () => n(`SELECT COUNT(*) AS n FROM ${S}.network_referrals WHERE network_id = '${net1}' AND referral_type = 'transfer'`);
          const r0 = refCount();
          coded('a network auditor (no transfer right) starting a transfer', await post({}, auditor.token), 403, 'HN_TRANSFER_FORBIDDEN');
          refused('a stranger starting a transfer in a network they are not in', await post({}, stranger.token), [403, 404]);
          coded('a transfer to the same hospital', await post({ toHospitalId: hA }), 400, 'HN_SAME_HOSPITAL');
          coded('a transfer to a hospital outside the network', await post({ toHospitalId: hX }), 400, 'HN_HOSPITAL_NOT_IN_NETWORK');
          coded('a transfer of an animal enrolled only in another network', await post({ animalId: dogN2 }), 400, 'HN_ANIMAL_NOT_PATIENT');
          coded('a transfer of an animal with no enrolment', await post({ animalId: dogNone }), 400, 'HN_ANIMAL_NOT_PATIENT');
          coded('a transfer from a hospital the patient is not at', await post({ fromHospitalId: hB, toHospitalId: hA }), 400, 'HN_NOT_AT_HOSPITAL');
          coded('a transfer with no reason', await post({ reason: '' }), 400, 'HN_TRANSFER_FIELDS');
          if (refCount() !== r0) problems.push('a refused transfer still created a network_referrals row');
          const listBad = await http('GET', `${apiBase}/hospital-networks/${net1}/patient-transfers`, null, director.token);
          const txt = JSON.stringify(listBad.json || {});
          if (txt.includes('Verify Hn Other Net Dog') || txt.includes('Verify Hn Unenrolled Dog')) problems.push('the transfer list showed the name of an animal that is not a patient of this network');
          refused('a non-member reading the transfer list', await http('GET', `${apiBase}/hospital-networks/${net1}/patient-transfers`, null, stranger.token), [403, 404]);

          const ok1 = await post({});
          const tid = ok1.json?.data?.id;
          if (ok1.status !== 200 || !tid) problems.push(`a member with the transfer right starting a transfer: HTTP ${ok1.status} ${msgOf(ok1).slice(0, 120)}`);
          else {
            const tr = rows(`SELECT referral_type, status, animal_id, from_hospital_id, to_hospital_id, network_id FROM ${S}.network_referrals WHERE id = '${tid}'`)[0] || {};
            if (tr.referral_type !== 'transfer' || tr.status !== 'pending' || tr.animal_id !== dogA || tr.from_hospital_id !== hA || tr.to_hospital_id !== hB || tr.network_id !== net1) problems.push(`the transfer row is wrong: ${JSON.stringify(tr)}`);
            for (const [who2, tok] of [['director', director.token], ['network admin', corp.token], ['auditor (member, read only)', auditor.token], ['platform admin', admin.token]]) {
              const l = await http('GET', `${apiBase}/hospital-networks/${net1}/patient-transfers`, null, tok);
              const t = (l.json?.data || []).find(x => x.id === tid);
              if (l.status !== 200 || !t || t.animalName !== 'Verify Hn Patient A' || t.fromHospitalName !== 'Verify Hn Hospital A' || t.toHospitalName !== 'Verify Hn Hospital B') problems.push(`${who2}: the transfer list must name the patient and both hospitals: HTTP ${l.status} ${JSON.stringify(t && { a: t.animalName, f: t.fromHospitalName, t: t.toHospitalName })}`);
            }
            coded('a second open transfer for the same patient', await post({}), 409, 'HN_TRANSFER_OPEN');
            coded('a member of another network completing the transfer', await http('POST', `${apiBase}/hospital-networks/${net1}/patient-transfers/${tid}/complete`, null, corp2.token), 403, 'HN_TRANSFER_FORBIDDEN');
            coded('a network auditor completing the transfer', await http('POST', `${apiBase}/hospital-networks/${net1}/patient-transfers/${tid}/complete`, null, auditor.token), 403, 'HN_TRANSFER_FORBIDDEN');
            const still = rows(`SELECT r.status, c.hospital_id FROM ${S}.network_referrals r JOIN ${S}.animal_care_contexts c ON c.animal_id = r.animal_id AND c.network_id = r.network_id WHERE r.id = '${tid}'`)[0] || {};
            if (still.status !== 'pending' || still.hospital_id !== hA) problems.push(`a refused completion changed things: ${JSON.stringify(still)}`);
            coded('completing a transfer that does not exist', await http('POST', `${apiBase}/hospital-networks/${net1}/patient-transfers/${uuid()}/complete`, null, director.token), 404, 'HN_TRANSFER_NOT_FOUND');
            const done = await http('POST', `${apiBase}/hospital-networks/${net1}/patient-transfers/${tid}/complete`, null, director.token);
            if (done.status !== 200) problems.push(`the right member completing the transfer: HTTP ${done.status} ${msgOf(done).slice(0, 120)}`);
            const after = rows(`SELECT r.status, c.hospital_id FROM ${S}.network_referrals r JOIN ${S}.animal_care_contexts c ON c.animal_id = r.animal_id AND c.network_id = r.network_id WHERE r.id = '${tid}'`)[0] || {};
            if (after.status !== 'completed' || after.hospital_id !== hB) problems.push(`after completing, the transfer must be completed and the care context at hospital B, got ${JSON.stringify(after)}`);
            const ownerNote = notifOf(ownerP.id, 'patient_transferred', `AND metadata->>'transferId' = '${tid}'`);
            if (ownerNote.length !== 1) problems.push(`the animal's owner must get exactly one patient_transferred notification, got ${ownerNote.length}`);
            if (notifOf(stranger.id, 'patient_transferred').length) problems.push('a person who does not own the animal was told about the transfer');
            coded('completing the same transfer again', await http('POST', `${apiBase}/hospital-networks/${net1}/patient-transfers/${tid}/complete`, null, director.token), 409, 'HN_TRANSFER_CLOSED');
            if (ownerNote.length && notifOf(ownerP.id, 'patient_transferred').length !== 1) problems.push('completing a second time sent the owner another notification');
          }
        }

        // ── 3. Pharmacist review shown to the prescribing vet ──
        if (dogA) {
          sql(`INSERT INTO bookings (pet_owner_id, veterinarian_id, animal_id, scheduled_date, time_slot_start, time_slot_end, status) VALUES ('${ownerP.id}', '${rxVet.id}', '${dogA}', CURRENT_DATE, '08:05', '23:59', 'confirmed');`);
          const rx = await http('POST', `${apiBase}/prescriptions`, { petOwnerId: ownerP.id, animalId: dogA, networkId: net1, diagnosis: 'Verify', instructions: '',
            medications: [{ name: 'Verify Hn Drug', dosage: '5 ml', frequency: 'Once daily', treatmentDays: 2, withdrawalMilkDays: 0, withdrawalMeatDays: 0 }] }, rxVet.token);
          const rid = rx.json?.data?.id;
          if (!rid) problems.push(`the vet's network prescription for the review journey: HTTP ${rx.status} ${msgOf(rx).slice(0, 140)}`);
          else {
            const rej = await http('POST', `${apiBase}/prescriptions/${rid}/review`, { review_status: 'rejected', rejection_reason: 'Verify Hn dose too high for this dog' }, pharmacist.token);
            const clar = await http('POST', `${apiBase}/prescriptions/${rid}/review`, { review_status: 'needs_clarification', suggested_modifications: 'Verify Hn halve the dose' }, pharmacist.token);
            if (rej.status !== 200 || clar.status !== 200) problems.push(`the pharmacist's two reviews: HTTP ${rej.status} and ${clar.status}`);
            for (const [who2, tok] of [['prescribing vet', rxVet.token], ['pet owner', ownerP.token], ['platform admin', admin.token]]) {
              const r = await http('GET', `${apiBase}/prescriptions/${rid}/reviews`, null, tok);
              const list = Array.isArray(r.json) ? r.json : [];
              const a = list.find(x => x.review_status === 'rejected'); const b = list.find(x => x.review_status === 'needs_clarification');
              if (r.status !== 200 || list.length !== 2 || !a || !b) problems.push(`${who2} reading the pharmacist's reviews: HTTP ${r.status}, ${list.length} found, expected the rejection and the clarification`);
              else {
                if (a.rejection_reason !== 'Verify Hn dose too high for this dog') problems.push(`${who2}: the rejection reason is '${a.rejection_reason}'`);
                if (b.suggested_modifications !== 'Verify Hn halve the dose') problems.push(`${who2}: the requested change is '${b.suggested_modifications}'`);
                if (a.pharmacist_name !== 'Hn Verify' || b.pharmacist_name !== 'Hn Verify') problems.push(`${who2}: pharmacist_name must be the pharmacist's name, got '${a.pharmacist_name}'`);
              }
            }
            refused('a vet unrelated to the prescription reading its reviews', await http('GET', `${apiBase}/prescriptions/${rid}/reviews`, null, otherVet.token), [403]);
            refused('a stranger reading the prescription reviews', await http('GET', `${apiBase}/prescriptions/${rid}/reviews`, null, stranger.token), [403]);
            if (notifOf(rxVet.id, 'prescription').length < 2) problems.push('the prescribing vet was not notified of both the rejection and the clarification request');
          }
        }

        // ── 4. Staff invite seat limit, suspension, removed routes ──
        const si = (email, tok = corp.token) => http('POST', `${apiBase}/hospital-networks/${net1}/staff-invites`, { inviteeEmail: email, inviteeName: 'Verify Hn Nurse', staffPosition: 'nurse', hospitalId: hA }, tok);
        sql(`UPDATE network_subscriptions SET seat_limit = ${memberCount() + 5}, status = 'active' WHERE network_id = '${net1}';`);
        const roomEmail = `verify.hn.room.${Date.now()}@example.com`;
        const room = await si(roomEmail);
        if (![200, 201].includes(room.status)) problems.push(`inviting staff with seats to spare: HTTP ${room.status} ${msgOf(room).slice(0, 120)}`);
        else if (n(`SELECT COUNT(*) AS n FROM ${S}.hospital_staff_invites WHERE network_id = '${net1}' AND invitee_email = '${roomEmail}'`) !== 1) problems.push('the staff invite with room did not create exactly one invite row');
        sql(`UPDATE network_subscriptions SET seat_limit = ${memberCount()} WHERE network_id = '${net1}';`);
        const used = memberCount();
        const invBefore = n(`SELECT COUNT(*) AS n FROM ${S}.hospital_staff_invites WHERE network_id = '${net1}'`);
        coded('inviting staff when the seat limit is reached (network admin)', await si(`verify.hn.full.${Date.now()}@example.com`), 403, 'HN_SEAT_LIMIT', { used, limit: used });
        coded('inviting staff when the seat limit is reached (director)', await si(`verify.hn.full2.${Date.now()}@example.com`, director.token), 403, 'HN_SEAT_LIMIT');
        sql(`UPDATE network_subscriptions SET status = 'suspended', seat_limit = 500 WHERE network_id = '${net1}';`);
        coded('inviting staff into a suspended network', await si(`verify.hn.susp.${Date.now()}@example.com`), 403, 'HN_NETWORK_SUSPENDED');
        if (n(`SELECT COUNT(*) AS n FROM ${S}.hospital_staff_invites WHERE network_id = '${net1}'`) !== invBefore) problems.push('a refused staff invite (seat limit / suspended) still created an invite row');
        sql(`UPDATE network_subscriptions SET status = 'active' WHERE network_id = '${net1}';`);
        const gone1 = await http('POST', `${apiBase}/hospital-networks/${net1}/invite-staff`, { invitee_email: `verify.hn.old.${Date.now()}@example.com`, staff_position: 'nurse' }, corp.token);
        const gone2 = await http('GET', `${apiBase}/hospital-networks/${net1}/patients`, null, corp.token);
        for (const [label, r] of [['the removed invite-staff route', gone1], ['the removed list-patients route', gone2]]) {
          if (r.status !== 404) problems.push(`${label} must answer 404, got HTTP ${r.status} ${msgOf(r).slice(0, 100)}`);
          else notes.push(`${label} answers 404 with '${msgOf(r).slice(0, 60)}'`);
        }

        // ── 5. Plans ──
        const priorVis = rows(`SELECT value FROM ${S}.system_settings WHERE key = 'pricing.visibility.corp_dashboard'`)[0]?.value;
        const setVis = (v) => sql(`INSERT INTO system_settings (key, value) VALUES ('pricing.visibility.corp_dashboard', '${v}') ON CONFLICT (key) DO UPDATE SET value = '${v}';`);
        setVis('false');
        const mp = await http('GET', `${apiBase}/my-network-subscription`, null, corp.token);
        const d = mp.json?.data || {};
        if (mp.status !== 200 || d.planName !== planUsedName) problems.push(`the corporate admin's plan must name the plan '${planUsedName}': HTTP ${mp.status} ${JSON.stringify(d).slice(0, 140)}`);
        if (Number(d.seatsUsed) !== memberCount()) problems.push(`seatsUsed must equal the real member count ${memberCount()}, got ${d.seatsUsed}`);
        if (Number(d.seat_limit) !== 500) problems.push(`seat_limit must be the subscription's seat limit (500), got ${d.seat_limit}`);
        if (d.priceMonthly !== undefined || d.priceAnnually !== undefined) problems.push(`the price must be hidden while pricing.visibility.corp_dashboard is false, got ${d.priceMonthly}/${d.priceAnnually}`);
        setVis('true');
        const mp2 = (await http('GET', `${apiBase}/my-network-subscription`, null, corp.token)).json?.data || {};
        if (Number(mp2.priceMonthly) !== 99) problems.push(`the price must show when pricing.visibility.corp_dashboard is true, got ${mp2.priceMonthly}`);
        if (priorVis === undefined) sql(`DELETE FROM system_settings WHERE key = 'pricing.visibility.corp_dashboard';`); else setVis(priorVis);
        const mpOther = (await http('GET', `${apiBase}/my-network-subscription`, null, corp2.token)).json?.data || {};
        if (mpOther.planName === planUsedName) problems.push("another network's corporate admin was shown this network's plan");
        refused('a pet owner reading my-network-subscription', await http('GET', `${apiBase}/my-network-subscription`, null, stranger.token), [403]);

        const listFor = async (tok) => ((await http('GET', `${apiBase}/network-subscription-plans`, null, tok)).json?.data || []).map(p => p.name);
        if (!(await listFor(corp.token)).includes(planFreeName)) problems.push('the unused published plan must list for a corporate admin before it is removed');
        refused('a corporate admin removing a plan', await http('DELETE', `${apiBase}/admin/network-subscription-plans/${planFree}`, null, corp.token), [403]);
        coded('removing a plan that a network uses', await http('DELETE', `${apiBase}/admin/network-subscription-plans/${planUsed}`, null, admin.token), 409, 'HN_PLAN_IN_USE');
        if (rows(`SELECT is_active FROM ${S}.network_subscription_plans WHERE id = '${planUsed}'`)[0]?.is_active !== true) problems.push('a plan in use was deactivated by a refused removal');
        const delOk = await http('DELETE', `${apiBase}/admin/network-subscription-plans/${planFree}`, null, admin.token);
        if (delOk.status !== 200) problems.push(`removing an unused plan: HTTP ${delOk.status} ${msgOf(delOk).slice(0, 100)}`);
        const names = await listFor(corp.token);
        if (names.includes(planFreeName)) problems.push('a removed plan still lists for a corporate admin');
        if (!names.includes(planUsedName)) problems.push('the plan in use disappeared from the corporate admin\'s plan list');
      }
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (notes.length) log(`   PHASE 6l notes: ${notes.join(' | ')}`);
      if (problems.length || sqlErrs.length) fail('A hospital-network follow-up journey (walk-in invite, transfer, pharmacist review, seat limit, plans) misbehaves.', [...problems, ...sqlErrs]);
      else ok('walk-in invite accept/refuse paths, patient transfer start/complete/refusals, pharmacist review for the vet, seat limit, removed routes and plans all behave');
    }

    // ── PHASE 6m: animal nutrition end to end (QA 2026-11-25) - one weight, no adult ration without an age, home-only pet diet,
    //    breeder caution, metabolic-illness vet gate, safe-food gaps, whole-module access (H15), connections to feed / stock /
    //    withdrawal / notifications / sale, and the milk-yield source ──
    if (serverHealthy && port) {
      step('PHASE 6m Nutrition end to end: one weight, age gate, home diet, breeder caution, metabolic gate, safe foods, access, connections');
      const apiBase = `http://127.0.0.1:${port}/api/v1`;
      const mark = serverLog.length;
      const problems = [];
      const notes = [];
      const S = SCHEMA;
      const sql = (q) => psql('verifydb', `SET search_path TO ${S}, public; ${q}`);
      const rows = (q) => psqlJson('verifydb', q);
      const uuid = () => require('crypto').randomUUID();
      const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
      const msgOf = (r) => r.json?.message || r.json?.error?.message || (typeof r.json?.error === 'string' ? r.json.error : '') || '';
      const codeOf = (r) => r.json?.error?.code || '';
      const plain = (r) => { const m = msgOf(r); return m.length >= 12 && !/status code|\bHTTP\b|\b[45]\d\d\b|\bat .+\(|undefined|\[object|Error:|violates|syntax/i.test(m); };
      let seq = (Math.floor(Date.now() / 1000) % 100000000) + 92000;
      let slotN = 0;
      try {
        sql(`INSERT INTO system_settings (key, value, description) VALUES ('nutrition.enabled', 'true', 'runtime-verify 6m') ON CONFLICT (key) DO UPDATE SET value = 'true';
             INSERT INTO system_settings (key, value, description) VALUES ('farm.records.enabled', 'true', 'runtime-verify 6m') ON CONFLICT (key) DO UPDATE SET value = 'true';
             INSERT INTO system_settings (key, value, description) VALUES ('nutrition.ai_assist.enabled', 'false', 'off in runtime-verify: no outside AI calls') ON CONFLICT (key) DO UPDATE SET value = 'false';`);
      } catch { problems.push('could not switch nutrition / farm records on (and the AI explanation off) in the verification database'); }
      const signUp = async (role, dbRole) => {
        const email = `verify.m6.${role}.${Date.now()}.${seq}@example.com`;
        const body = { firstName: 'Nm', lastName: 'Verify', email, phone: `9${String(seq++).padStart(9, '0')}`, password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true };
        if (role === 'veterinarian') body.licenseNumber = 'VERIFY-LIC-6M';
        await http('POST', `${apiBase}/auth/register`, body);
        if (dbRole || role === 'veterinarian') sql(`UPDATE users SET ${dbRole ? `role = '${dbRole}', ` : ''}account_status = 'active', is_active = true WHERE email = '${email}';`);
        const login = await http('POST', `${apiBase}/auth/login`, { email, password: 'Password1' });
        return { token: login.json?.data?.token, id: login.json?.data?.user?.id, email };
      };
      // The server caches each module switch for 60 s: wait until it reports both on.
      {
        const probe = (await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' })).json?.data?.token;
        const until = Date.now() + 90000;
        let on = false;
        while (probe && Date.now() < until) {
          const a = await http('GET', `${apiBase}/farm-records/enabled`, null, probe);
          const b = await http('GET', `${apiBase}/nutrition/enabled`, null, probe);
          if (a.json?.data?.enabled === true && b.json?.data?.enabled === true) { on = true; break; }
          await sleep(3000);
        }
        if (!on) problems.push('the server still reports farm records / nutrition off 90 s after they were switched on');
      }
      const admin = await signUp('pet_owner', 'admin');
      const ownerP = await signUp('pet_owner');
      const stranger = await signUp('pet_owner');
      const vetB = await signUp('veterinarian');   // booked
      const vetU = await signUp('veterinarian');   // never booked
      const worker = await signUp('pet_owner');
      const viewer = await signUp('pet_owner');
      const mgr = await signUp('pet_owner');
      const hs = await signUp('pet_owner', 'hospital_staff');
      const pharm = await signUp('pet_owner', 'pharmacist');
      const tomLogin = await http('POST', `${apiBase}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
      const tom = { token: tomLogin.json?.data?.token, id: tomLogin.json?.data?.user?.id };
      let ent = null; let herd = null;
      try {
        ent = rows(`SELECT e.id FROM ${S}.enterprises e JOIN ${S}.users u ON u.id = e.owner_id WHERE u.email = 'tom.wilson@example.com' ORDER BY e.created_at LIMIT 1`)[0]?.id;
        herd = rows(`SELECT id FROM ${S}.animal_groups WHERE enterprise_id = '${ent}' AND species = 'Cattle' LIMIT 1`)[0]?.id;
      } catch { /* reported below */ }
      const people = { admin, ownerP, stranger, vetB, vetU, worker, viewer, mgr, hs, pharm };
      const missing = Object.entries(people).filter(([, u]) => !u.token || !u.id).map(([k]) => k);
      if (missing.length || !tom.token || !ent || !herd) problems.push(`could not set up the accounts / seeded farm for the nutrition journeys (missing: ${missing.join(', ')}${!tom.token ? ', tom' : ''}${!ent ? ', farm' : ''}${!herd ? ', herd' : ''})`);
      else {
        // Handed to the browser spec (frontend/e2e/nutrition-devices.spec.ts) through NUTRI_FIXTURES in PHASE 7.
        const fx = (globalThis.__nutriFixtures = { accounts: {
          farmer: { email: 'tom.wilson@example.com', password: 'Demo@123' }, pet_owner: { email: ownerP.email, password: 'Password1' },
          veterinarian: { email: vetB.email, password: 'Password1' }, admin: { email: admin.email, password: 'Password1' } } });
        // fixtures: farm team, hospital network the animals were NOT given to
        const net = uuid(); const hosp = uuid();
        sql(`INSERT INTO enterprise_members (enterprise_id, user_id, role) VALUES ('${ent}', '${worker.id}', 'worker'), ('${ent}', '${viewer.id}', 'viewer'), ('${ent}', '${mgr.id}', 'manager') ON CONFLICT DO NOTHING;
             INSERT INTO hospital_networks (id, name) VALUES ('${net}', 'Verify 6m Network');
             INSERT INTO vet_hospitals (id, name, owner_id) VALUES ('${hosp}', 'Verify 6m Hospital', '${admin.id}');
             INSERT INTO hospital_network_hospitals (network_id, hospital_id) VALUES ('${net}', '${hosp}');
             INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id) VALUES ('${net}', '${hs.id}', 'hospital_staff', '${hosp}'), ('${net}', '${pharm.id}', 'hospital_staff', '${hosp}');`);
        const book = (vetId, ownerId, col, id, withEnt) => {
          const m = 8 * 60 + 5 * slotN++;
          const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
          sql(`INSERT INTO bookings (pet_owner_id, veterinarian_id, ${col}, ${withEnt ? 'enterprise_id, ' : ''}scheduled_date, time_slot_start, time_slot_end, status) VALUES ('${ownerId}', '${vetId}', '${id}', ${withEnt ? `'${ent}', ` : ''}CURRENT_DATE, '${t}', '23:59', 'confirmed');`);
        };
        const mk = async (tok, body, kg) => {
          const a = await http('POST', `${apiBase}/animals`, body, tok);
          const id = a.json?.data?.id;
          if (!id) problems.push(`could not create ${body.name}: HTTP ${a.status} ${msgOf(a).slice(0, 120)}`);
          else if (kg) await http('POST', `${apiBase}/nutrition/animals/${id}/measurements`, { weight: kg, unit: 'kg' }, tok);
          return id;
        };
        const foodMap = async (q, tok) => Object.fromEntries(((await http('GET', `${apiBase}/nutrition/foods?${q}`, null, tok)).json?.data?.items || []).map(f => [f.code || f.label, f.id]));
        const COW_FEEDS = ['feed_green_maize', 'feed_wheat_straw', 'feed_cattle_feed', 'feed_groundnut_cake', 'feed_mineral_mixture'];
        const COW_PRICE = [2, 6, 25, 45, 80];
        const cowBody = (fm, milk = 10) => ({ milkLitresPerDay: milk, feeds: COW_FEEDS.map((c, i) => ({ ingredientId: fm[c], pricePerKg: COW_PRICE[i] })) });
        const refusal = (label, r) => {
          if (![403, 404].includes(r.status)) problems.push(`${label}: expected a refusal (403/404), got HTTP ${r.status} ${msgOf(r).slice(0, 80)}`);
          else if (!plain(r)) problems.push(`${label}: refused (HTTP ${r.status}) without plain words: '${msgOf(r).slice(0, 110)}'`);
        };
        const notifs = (userId, type, extra = '') => rows(`SELECT id, metadata->>'planId' AS plan_id, metadata->>'dedupeKey' AS dk FROM ${S}.notifications WHERE user_id = '${userId}' AND metadata->>'type' = '${type}' ${extra}`);

        // ═══ 1. ONE WEIGHT ═══
        {
          const dog = await mk(ownerP.token, { name: 'Verify M1 Dog', species: 'Dog', gender: 'male', weight: 12, dateOfBirth: iso(-1800) });
          if (dog) {
            book(vetB.id, ownerP.id, 'animal_id', dog, false);
            const whRows = () => rows(`SELECT weight, source, recorded_at FROM ${S}.weight_history WHERE animal_id = '${dog}' AND weight IS NOT NULL ORDER BY recorded_at, created_at`);
            const aw = () => rows(`SELECT weight, current_weight, last_weighed_at FROM ${S}.animals WHERE id = '${dog}'`)[0] || {};
            const w0 = whRows(); const a0 = aw();
            if (w0.length !== 1 || Number(w0[0]?.weight) !== 12) problems.push(`[1 one weight] creating an animal with weight 12 should leave exactly ONE weight_history row of 12, found ${w0.length} (${w0.map(w => w.weight)})`);
            if (Number(a0.weight) !== 12 || Number(a0.current_weight) !== 12) problems.push(`[1 one weight] after create animals.weight=${a0.weight} current_weight=${a0.current_weight}, both must be 12`);
            await sleep(1100);
            const p1 = await http('PUT', `${apiBase}/animals/${dog}`, { weight: 14 }, ownerP.token);
            const w1 = whRows(); const a1 = aw();
            if (p1.status !== 200) problems.push(`[1 one weight] PUT /animals/:id {weight:14}: HTTP ${p1.status} ${msgOf(p1).slice(0, 100)} (the brief said PATCH; the route is PUT, there is no PATCH /animals/:id)`);
            if (w1.length !== 2 || Number(w1[w1.length - 1]?.weight) !== 14 || w1[w1.length - 1]?.source !== 'medical_record') problems.push(`[1 one weight] a typed weight of 14 must add ONE history row (source medical_record); rows ${w1.length}, newest ${w1[w1.length - 1]?.weight}/${w1[w1.length - 1]?.source}`);
            if (Number(a1.weight) !== 14 || Number(a1.current_weight) !== 14) problems.push(`[1 one weight] after PUT weight=${a1.weight} current_weight=${a1.current_weight}, both must be 14`);
            if (!(new Date(a1.last_weighed_at) > new Date(a0.last_weighed_at))) problems.push(`[1 one weight] last_weighed_at did not move forward (${a0.last_weighed_at} -> ${a1.last_weighed_at})`);
            await http('PUT', `${apiBase}/animals/${dog}`, { weight: 14 }, ownerP.token);
            if (whRows().length !== 2) problems.push(`[1 one weight] saving the SAME weight again stacked a row (${whRows().length} rows, want 2)`);
            const back = await http('POST', `${apiBase}/nutrition/animals/${dog}/measurements`, { weight: 9, unit: 'kg', recordedAt: `${iso(-3)}T10:00:00Z` }, ownerP.token);
            if (back.status !== 201) problems.push(`[1 one weight] a back-dated weighing: HTTP ${back.status} ${msgOf(back).slice(0, 100)}`);
            const a2 = aw();
            if (Number(a2.weight) !== 14 || Number(a2.current_weight) !== 14) problems.push(`[1 one weight] a lower BACK-DATED weighing overwrote the newer current weight (weight=${a2.weight}, current_weight=${a2.current_weight}, want 14). (POST /weight-history takes no date, so the back-dated entry was sent through POST /nutrition/animals/:id/measurements)`);
            const ov = await http('GET', `${apiBase}/nutrition/animals/${dog}`, null, ownerP.token);
            if (ov.json?.data?.facts?.weightKg !== 14) problems.push(`[1 one weight] the nutrition overview shows weight ${ov.json?.data?.facts?.weightKg}, the animal has 14`);
            for (const [who, tok] of [['owner', ownerP.token], ['booked vet', vetB.token]]) {
              const wh = await http('GET', `${apiBase}/weight-history/animal/${dog}`, null, tok);
              const list = (wh.json?.data || []).filter(w => w.weight !== null);
              const latest = [...list].sort((x, y) => new Date(y.recordedAt) - new Date(x.recordedAt))[0];
              if (wh.status !== 200 || Number(latest?.weight) !== 14) problems.push(`[1 one weight] the weight chart read by the ${who} ends at ${latest?.weight} (HTTP ${wh.status}), the animal has 14`);
            }
            const ovV = await http('GET', `${apiBase}/nutrition/animals/${dog}`, null, vetB.token);
            if (ovV.json?.data?.facts?.weightKg !== 14) problems.push(`[1 one weight] the booked vet's nutrition view shows weight ${ovV.json?.data?.facts?.weightKg}, want 14`);
            const before = whRows().length;
            for (const bad of [-5, 'abc']) {
              const r = await http('PUT', `${apiBase}/animals/${dog}`, { weight: bad }, ownerP.token);
              if (r.status !== 400 || !plain(r)) problems.push(`[1 one weight] PUT weight ${JSON.stringify(bad)} should be 400 in words, got HTTP ${r.status} '${msgOf(r).slice(0, 90)}'`);
            }
            const neg = await http('POST', `${apiBase}/weight-history`, { animalId: dog, weight: -5, unit: 'kg' }, ownerP.token);
            if (neg.status !== 400 || !plain(neg)) problems.push(`[1 one weight] POST /weight-history -5 should be 400 in words, got HTTP ${neg.status} '${msgOf(neg).slice(0, 90)}'`);
            if (whRows().length !== before || Number(aw().weight) !== 14) problems.push('[1 one weight] a refused weight still wrote a row or changed the animal');
            const strangerPut = await http('PUT', `${apiBase}/animals/${dog}`, { weight: 99 }, stranger.token);
            refusal('[1 one weight] a stranger editing the weight of another owner\'s animal', strangerPut);
          }
        }

        // ═══ 2. NO ADULT RATION WITHOUT AGE ═══
        {
          const cow = await mk(ownerP.token, { name: 'Verify M2 Cow', species: 'Cattle', gender: 'female' }, 400);
          const horse = await mk(ownerP.token, { name: 'Verify M2 Horse', species: 'Horse', gender: 'male' }, 450);
          const calf = await mk(ownerP.token, { name: 'Verify M2 Calf', species: 'Cattle', gender: 'female', dateOfBirth: iso(-30) }, 45);
          if (cow && horse && calf) {
            const cf = await foodMap(`animalId=${cow}`, ownerP.token);
            const hf = await foodMap(`animalId=${horse}`, ownerP.token);
            const need = (f, list) => list.filter(c => !f[c]);
            const horseBody = { work: 'moderate', feeds: [['feed_grass_hay', 8], ['feed_lucerne_hay', 18], ['feed_oats', 30], ['feed_mineral_mixture', 80]].map(([c, p]) => ({ ingredientId: hf[c], pricePerKg: p })) };
            if (need(cf, COW_FEEDS).length || need(hf, ['feed_grass_hay', 'feed_lucerne_hay', 'feed_oats', 'feed_mineral_mixture']).length) problems.push('[2 age] the seeded cattle / horse feeds are missing');
            else {
              for (const [what, id, body] of [['cow', cow, cowBody(cf)], ['horse', horse, horseBody]]) {
                const pv = await http('POST', `${apiBase}/nutrition/animals/${id}/ration/preview`, body, ownerP.token);
                coded2(`[2 age] ${what} with no date of birth - preview`, pv);
                const sv = await http('POST', `${apiBase}/nutrition/animals/${id}/ration`, body, ownerP.token);
                coded2(`[2 age] ${what} with no date of birth - save`, sv);
                const planRows = Number(rows(`SELECT COUNT(*) AS n FROM ${S}.nutrition_plans WHERE animal_id = '${id}'`)[0]?.n);
                if (planRows !== 0) problems.push(`[2 age] a ${what} with no date of birth still got ${planRows} plan row(s) saved`);
                await http('PUT', `${apiBase}/animals/${id}`, { dateOfBirth: iso(-365 * 6) }, ownerP.token);
                const ok2 = await http('POST', `${apiBase}/nutrition/animals/${id}/ration`, body, ownerP.token);
                if (ok2.status !== 201 || ok2.json?.data?.status !== 'active') problems.push(`[2 age] after adding a date of birth the ${what} ration should save as active, got HTTP ${ok2.status} ${msgOf(ok2).slice(0, 100)}`);
              }
              const calfFoods = await foodMap(`animalId=${calf}`, ownerP.token);
              const cr = await http('POST', `${apiBase}/nutrition/animals/${calf}/ration/preview`, { feeds: [{ ingredientId: calfFoods.feed_green_maize, pricePerKg: 2 }] }, ownerP.token);
              if (cr.status !== 400 || codeOf(cr) !== 'NEEDS_VET' || !plain(cr)) problems.push(`[2 age] a 30-day-old calf should still be sent to a vet (NEEDS_VET), got HTTP ${cr.status} code '${codeOf(cr)}' '${msgOf(cr).slice(0, 80)}'`);
              const gf = await foodMap(`groupId=${herd}`, tom.token);
              const gp = await http('POST', `${apiBase}/nutrition/groups/${herd}/ration/preview`, { milkLitresPerDay: 8, avgWeightKg: 400, feeds: COW_FEEDS.map((c, i) => ({ ingredientId: gf[c], pricePerKg: COW_PRICE[i] })) }, tom.token);
              if (gp.status !== 200 || gp.json?.data?.result?.status !== 'ok') problems.push(`[2 age] a herd of mixed ages (members have no date of birth) must still compute: HTTP ${gp.status} ${codeOf(gp)} ${msgOf(gp).slice(0, 100)}`);
            }
          }
        }
        function coded2(label, r) {
          if (r.status !== 400 || codeOf(r) !== 'NUT_AGE_REQUIRED') problems.push(`${label}: expected HTTP 400 code NUT_AGE_REQUIRED, got HTTP ${r.status} code '${codeOf(r)}' '${msgOf(r).slice(0, 90)}'`);
          else if (!plain(r)) problems.push(`${label}: NUT_AGE_REQUIRED came back without plain words: '${msgOf(r).slice(0, 110)}'`);
        }

        // ═══ 3. HOME-ONLY PET PLAN ═══
        {
          const petFacts = { isNeutered: true, activityLevel: 'moderate', housing: 'indoor' };
          const dogA = await mk(ownerP.token, { name: 'Verify M3 Adult Dog', species: 'Dog', gender: 'male', dateOfBirth: iso(-1800) }, 20);
          const puppy = await mk(ownerP.token, { name: 'Verify M3 Puppy', species: 'Dog', gender: 'male', dateOfBirth: iso(-120) }, 5);
          const kitten = await mk(ownerP.token, { name: 'Verify M3 Kitten', species: 'Cat', gender: 'female', dateOfBirth: iso(-100) }, 2);
          const catA = await mk(ownerP.token, { name: 'Verify M3 Adult Cat', species: 'Cat', gender: 'female', dateOfBirth: iso(-1500) }, 4);
          for (const id of [dogA, puppy, kitten, catA]) if (id) await http('PATCH', `${apiBase}/nutrition/animals/${id}/facts`, petFacts, ownerP.token);
          if (dogA && puppy && kitten && catA) {
            const mkFood = async (animalId, label, kind, kcal) => (await http('POST', `${apiBase}/nutrition/foods`, { animalId, label, kcalPer100g: kcal, kind }, ownerP.token)).json?.data?.id;
            const dFoods = await foodMap(`animalId=${dogA}`, ownerP.token);
            const rice = dFoods.home_rice_cooked;
            const kibble = await mkFood(dogA, 'Verify kibble complete', 'commercial_food', 360);
            const treatId = await mkFood(dogA, 'Verify biscuit treat', 'treat', 400);
            if (!rice || !kibble || !treatId) problems.push(`[3 home diet] could not set up a home food (${!!rice}), a commercial food (${!!kibble}) and a treat (${!!treatId})`);
            else {
              const homeOnly = { goal: 'maintain', mealsPerDay: 2, foods: [{ ingredientId: rice, sharePct: 100 }] };
              const pre = await http('POST', `${apiBase}/nutrition/animals/${dogA}/plan/preview`, homeOnly, ownerP.token);
              if (pre.status !== 200) problems.push(`[3 home diet] preview of a home-only plan: HTTP ${pre.status} ${msgOf(pre).slice(0, 100)}`);
              else if (pre.json?.data?.incompleteDiet !== true) problems.push(`[3 home diet] the PREVIEW of a home-only plan does not carry incompleteDiet (got ${JSON.stringify(pre.json?.data?.incompleteDiet)}). The plan sheet reads preview.incompleteDiet to show its warning (PlanBuilderSheet.tsx:195), but the preview route (nutrition.routes.ts) returns only energy/portions/unsafe/mealsPerDay`);
              const saved = await http('POST', `${apiBase}/nutrition/animals/${dogA}/plan`, homeOnly, ownerP.token);
              if (saved.status !== 201 || saved.json?.data?.incompleteDiet !== true) problems.push(`[3 home diet] the SAVED home-only plan should carry incompleteDiet true: HTTP ${saved.status} incompleteDiet=${saved.json?.data?.incompleteDiet}`);
              const ov = await http('GET', `${apiBase}/nutrition/animals/${dogA}`, null, ownerP.token);
              if (ov.json?.data?.plan?.incompleteDiet !== true) problems.push(`[3 home diet] overview plan.incompleteDiet should be true, got ${ov.json?.data?.plan?.incompleteDiet}`);
              for (const [what, foods] of [['custom-typed food', [{ label: 'Verify home mix', kcalPer100g: 150, sharePct: 100 }]], ['treat only', [{ ingredientId: treatId, sharePct: 100 }]]]) {
                const r = await http('POST', `${apiBase}/nutrition/animals/${dogA}/plan`, { goal: 'maintain', mealsPerDay: 2, foods }, ownerP.token);
                if (r.status !== 201 || r.json?.data?.incompleteDiet !== true) problems.push(`[3 home diet] a ${what} plan should be incompleteDiet true: HTTP ${r.status} ${r.json?.data?.incompleteDiet} ${msgOf(r).slice(0, 80)}`);
              }
              const full = await http('POST', `${apiBase}/nutrition/animals/${dogA}/plan`, { goal: 'maintain', mealsPerDay: 2, foods: [{ ingredientId: kibble, sharePct: 70 }, { ingredientId: rice, sharePct: 30 }] }, ownerP.token);
              if (full.status !== 201 || full.json?.data?.incompleteDiet !== false) problems.push(`[3 home diet] with one commercial food added incompleteDiet should be false: HTTP ${full.status} ${full.json?.data?.incompleteDiet}`);
              const ov2 = await http('GET', `${apiBase}/nutrition/animals/${dogA}`, null, ownerP.token);
              if (ov2.json?.data?.plan?.incompleteDiet !== false) problems.push(`[3 home diet] overview plan.incompleteDiet should now be false, got ${ov2.json?.data?.plan?.incompleteDiet}`);

              for (const [what, id] of [['puppy', puppy], ['kitten', kitten]]) {
                const food = await mkFood(id, `Verify home ${what} food`, 'home_food', 130);
                const home = { goal: 'maintain', mealsPerDay: 3, foods: [{ ingredientId: food, sharePct: 100 }] };
                for (const route of ['plan', 'plan/preview']) {
                  const r = await http('POST', `${apiBase}/nutrition/animals/${id}/${route}`, home, ownerP.token);
                  if (r.status !== 400 || codeOf(r) !== 'NUT_HOME_DIET_YOUNG' || !plain(r)) problems.push(`[3 home diet] a home-only ${route} for a ${what} under 12 months should be 400 NUT_HOME_DIET_YOUNG in words, got HTTP ${r.status} code '${codeOf(r)}' '${msgOf(r).slice(0, 80)}'`);
                }
                const n = Number(rows(`SELECT COUNT(*) AS n FROM ${S}.nutrition_plans WHERE animal_id = '${id}'`)[0]?.n);
                if (n !== 0) problems.push(`[3 home diet] the refused ${what} plan still left ${n} plan row(s)`);
              }
              const kfood = await mkFood(puppy, 'Verify puppy complete food', 'commercial_food', 380);
              const pOk = await http('POST', `${apiBase}/nutrition/animals/${puppy}/plan`, { goal: 'maintain', mealsPerDay: 3, foods: [{ ingredientId: kfood, sharePct: 100 }] }, ownerP.token);
              if (pOk.status !== 201) problems.push(`[3 home diet] a puppy on a complete food must be allowed: HTTP ${pOk.status} ${msgOf(pOk).slice(0, 100)}`);
              const catFood = await mkFood(catA, 'Verify home cat food', 'home_food', 140);
              const cOk = await http('POST', `${apiBase}/nutrition/animals/${catA}/plan`, { goal: 'maintain', mealsPerDay: 2, foods: [{ ingredientId: catFood, sharePct: 100 }] }, ownerP.token);
              if (cOk.status !== 201 || cOk.json?.data?.incompleteDiet !== true) problems.push(`[3 home diet] an adult cat on a home-only plan is allowed with the warning: HTTP ${cOk.status} incompleteDiet=${cOk.json?.data?.incompleteDiet} ${msgOf(cOk).slice(0, 80)}`);
            }
          }
        }

        // ═══ 4. BAND CAUTION ═══
        {
          const cols = rows(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${S}' AND table_name = 'nutrition_feeding_curves' AND column_name = 'caution_key'`);
          if (!cols.length) problems.push('[4 caution] nutrition_feeding_curves.caution_key is missing (migration 069)');
          else {
            const flagged = rows(`SELECT curve_key, feed_type FROM ${S}.nutrition_feeding_curves WHERE caution_key = 'breeders_need_vet'`);
            if (flagged.length !== 1 || flagged[0].curve_key !== 'pig_general' || flagged[0].feed_type !== 'adult / sow') problems.push(`[4 caution] only the pig adult/sow band should carry breeders_need_vet, found ${JSON.stringify(flagged)}`);
          }
          const group = (name, species, type, startedDaysAgo, placementAge) => {
            const g = uuid();
            sql(`INSERT INTO animal_groups (id, enterprise_id, name, species, group_type, current_count) VALUES ('${g}', '${ent}', '${name}', '${species}', ${type ? `'${type}'` : 'NULL'}, 10);
                 INSERT INTO group_cycles (group_id, cycle_number, species, placed_count, current_count, started_at, status${placementAge ? ', age_at_placement_days' : ''}) VALUES ('${g}', 1, '${species}', 10, 10, CURRENT_DATE - ${startedDaysAgo}, 'active'${placementAge ? `, ${placementAge}` : ''});`);
            return g;
          };
          try {
            const old = group('Verify M4 Old Pigs', 'Pig', null, 300, 0);
            fx.pigGroupId = old; fx.pigGroupName = 'Verify M4 Old Pigs';
            const placed = group('Verify M4 Placed Pigs', 'Pig', null, 100, 150);
            const young = group('Verify M4 Young Pigs', 'Pig', null, 50, 0);
            const hens = group('Verify M4 Hens', 'Chicken', 'layers', 300, 0);
            for (const [what, id, want] of [['a pig group over 221 days', old, 'breeders_need_vet'], ['a pig group placed at 150 days, 100 days ago', placed, 'breeders_need_vet'], ['a young pig group', young, null], ['a poultry group', hens, null]]) {
              const r = await http('GET', `${apiBase}/nutrition/groups/${id}/feeding`, null, tom.token);
              const got = r.json?.data?.today?.cautionKey;
              if (r.status !== 200 || r.json?.data?.status !== 'ok') problems.push(`[4 caution] feeding card for ${what}: HTTP ${r.status}, status ${r.json?.data?.status}`);
              else if ((got ?? null) !== want) problems.push(`[4 caution] ${what}: today.cautionKey should be ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
            }
          } catch (e) { problems.push(`[4 caution] could not create the pig / poultry groups: ${String(e.message).slice(0, 150)}`); }
        }

        // ═══ 5. METABOLIC GATE ═══
        {
          const plant = async (label, animalOwner, extraSetup) => {
            const id = await mk(animalOwner.token, { name: label, species: 'Cattle', gender: 'female', dateOfBirth: iso(-365 * 5) }, 400);
            if (extraSetup) await extraSetup(id);
            return id;
          };
          const cowK = await plant('Verify M5 Ketosis Cow', ownerP, async (id) => book(vetB.id, ownerP.id, 'animal_id', id, false));
          if (cowK) {
            const fm = await foodMap(`animalId=${cowK}`, ownerP.token);
            const first = await http('POST', `${apiBase}/nutrition/animals/${cowK}/ration`, cowBody(fm, 10), ownerP.token);
            if (first.status !== 201 || first.json?.data?.status !== 'active') problems.push(`[5 metabolic] a cow without a condition should get an ACTIVE ration at once: HTTP ${first.status} ${first.json?.data?.status}`);
            sql(`INSERT INTO medical_records (user_id, animal_id, record_type, title, content, status) VALUES ('${ownerP.id}', '${cowK}', 'diagnosis', 'Ketosis', 'subclinical', 'active');`);
            const second = await http('POST', `${apiBase}/nutrition/animals/${cowK}/ration`, cowBody(fm, 12), ownerP.token);
            const draftId = second.json?.data?.id;
            if (second.status !== 201 || second.json?.data?.status !== 'draft' || !(second.json?.data?.conditions || []).includes('metabolic')) problems.push(`[5 metabolic] a ration for a cow with ketosis on record must wait as a draft (conditions metabolic): HTTP ${second.status} status ${second.json?.data?.status} conditions ${JSON.stringify(second.json?.data?.conditions)}`);
            const ov = await http('GET', `${apiBase}/nutrition/animals/${cowK}`, null, ownerP.token);
            if (ov.json?.data?.plan?.id !== first.json?.data?.id) problems.push('[5 metabolic] the ration in use changed before a vet looked at the draft');
            if (!draftId || ov.json?.data?.pendingPlan?.id !== draftId) problems.push('[5 metabolic] the waiting ration is not shown as pending on the animal');
            const vNotes = draftId ? notifs(vetB.id, 'nutrition_plan_review', `AND metadata->>'planId' = '${draftId}'`) : [];
            if (vNotes.length !== 1) problems.push(`[5 metabolic] the connected vet should be told ONCE about the waiting ration, got ${vNotes.length} notification(s)`);
            for (const [who, u] of [['unbooked vet', vetU], ['stranger', stranger]]) {
              if (notifs(u.id, 'nutrition_plan_review').length) problems.push(`[5 metabolic] the ${who} was notified about another person's waiting ration`);
            }
            const ownerNotes = notifs(ownerP.id, 'nutrition_plan_review').length;
            if (ownerNotes === 0) notes.push('waiting ration notifies only the connected vet (NutritionNotifier.planWaitingForVet); the owner who saved it gets no note - matches ledger NUT-174, differs from the QA brief ("farm owner/team and the connected vet")');
            const ownerActivate = await http('POST', `${apiBase}/nutrition/plans/${draftId}/review`, { note: 'x' }, ownerP.token);
            refusal('[5 metabolic] the owner activating the waiting ration', ownerActivate);
            const strangerActivate = await http('POST', `${apiBase}/nutrition/plans/${draftId}/review`, { note: 'x' }, vetU.token);
            refusal('[5 metabolic] an unbooked vet activating the waiting ration', strangerActivate);
            const rev = await http('POST', `${apiBase}/nutrition/plans/${draftId}/review`, { note: 'Checked: ketosis managed' }, vetB.token);
            if (rev.status >= 300) problems.push(`[5 metabolic] the booked vet activating the draft: HTTP ${rev.status} ${msgOf(rev).slice(0, 100)}`);
            const ov2 = await http('GET', `${apiBase}/nutrition/animals/${cowK}`, null, ownerP.token);
            if (ov2.json?.data?.plan?.id !== draftId || ov2.json?.data?.plan?.validation !== 'vet_reviewed' || ov2.json?.data?.pendingPlan) problems.push(`[5 metabolic] after the vet's review the draft must be the plan in use and reviewed, nothing pending (plan ${ov2.json?.data?.plan?.id === draftId}, validation ${ov2.json?.data?.plan?.validation}, pending ${!!ov2.json?.data?.pendingPlan})`);
          }
          fx.ownerCowId = cowK;
          // a ration left waiting for a vet (the vet's pending card in the browser spec)
          const cowP = await plant('Verify UI Pending Cow', ownerP, async (id) => book(vetB.id, ownerP.id, 'animal_id', id, false));
          if (cowP) {
            const fmP = await foodMap(`animalId=${cowP}`, ownerP.token);
            await http('POST', `${apiBase}/nutrition/animals/${cowP}/ration`, cowBody(fmP, 10), ownerP.token);
            sql(`INSERT INTO medical_records (user_id, animal_id, record_type, title, content, status) VALUES ('${ownerP.id}', '${cowP}', 'diagnosis', 'Ketosis', 'ui fixture', 'active');`);
            const waitingP = await http('POST', `${apiBase}/nutrition/animals/${cowP}/ration`, cowBody(fmP, 12), ownerP.token);
            if (waitingP.json?.data?.status === 'draft') fx.pendingCowId = cowP;
          }
          // an abnormal BHB lab result gates the same way
          const cowL = await plant('Verify M5 Lab Cow', ownerP);
          if (cowL) {
            const fm = await foodMap(`animalId=${cowL}`, ownerP.token);
            const first = await http('POST', `${apiBase}/nutrition/animals/${cowL}/ration`, cowBody(fm, 10), ownerP.token);
            sql(`INSERT INTO lab_results (animal_id, test_name, test_date, result_value, normal_range, unit, is_abnormal, status) VALUES ('${cowL}', 'BHB (beta-hydroxybutyrate)', CURRENT_DATE, '3.4', '< 1.2', 'mmol/L', true, 'completed');`);
            const second = await http('POST', `${apiBase}/nutrition/animals/${cowL}/ration`, cowBody(fm, 12), ownerP.token);
            if (first.status !== 201 || second.json?.data?.status !== 'draft' || !(second.json?.data?.conditions || []).includes('metabolic')) problems.push(`[5 metabolic] an abnormal BHB lab result should send the new ration to a vet (draft, metabolic), got status ${second.json?.data?.status} conditions ${JSON.stringify(second.json?.data?.conditions)} (HTTP ${second.status} ${msgOf(second).slice(0, 80)})`);
          }
          // a farm cow: the team member who saves it, and who is told
          const cowF = await plant('Verify M5 Farm Cow', tom, async (id) => { await http('PUT', `${apiBase}/animals/${id}`, { enterpriseId: ent }, tom.token); book(vetB.id, tom.id, 'animal_id', id, true); });
          if (cowF) {
            const fm = await foodMap(`animalId=${cowF}`, tom.token);
            await http('POST', `${apiBase}/nutrition/animals/${cowF}/ration`, cowBody(fm, 10), tom.token);
            sql(`INSERT INTO medical_records (user_id, animal_id, record_type, title, content, status) VALUES ('${tom.id}', '${cowF}', 'diagnosis', 'Milk fever', 'hypocalcaemia', 'active');`);
            const byWorker = await http('POST', `${apiBase}/nutrition/animals/${cowF}/ration`, cowBody(fm, 12), worker.token);
            if (byWorker.status !== 201 || byWorker.json?.data?.status !== 'draft') problems.push(`[5 metabolic] a farm worker saving a ration for a cow with milk fever must create a draft: HTTP ${byWorker.status} ${byWorker.json?.data?.status} ${msgOf(byWorker).slice(0, 90)}`);
            const byViewer = await http('POST', `${apiBase}/nutrition/animals/${cowF}/ration`, cowBody(fm, 12), viewer.token);
            refusal('[5 metabolic] a farm viewer saving a ration', byViewer);
            const draft = byWorker.json?.data?.id;
            const tomN = notifs(tom.id, 'nutrition_plan_review', `AND metadata->>'planId' = '${draft}'`).length;
            const mgrN = notifs(mgr.id, 'nutrition_plan_review', `AND metadata->>'planId' = '${draft}'`).length;
            const vetN = notifs(vetB.id, 'nutrition_plan_review', `AND metadata->>'planId' = '${draft}'`).length;
            if (vetN !== 1) problems.push(`[5 metabolic] the connected vet of a farm cow's waiting ration should be told once, got ${vetN}`);
            if (tomN === 0 || mgrN === 0) notes.push(`waiting ration on a FARM cow saved by a worker: farm owner told ${tomN}x, manager ${mgrN}x, vet ${vetN}x - only vets are notified (planWaitingForVet), the farm owner/manager are not`);
          }
        }

        // ═══ 6. SAFE-FOOD GAPS ═══
        {
          const species = [['Pig', 'Pig', ['urea_nonruminant']], ['Horse', 'Horse', ['oleander', 'lawn_clippings']], ['Chicken', 'Chicken', ['chocolate_bird']], ['Dog', 'Dog', ['dough_raw', 'mushrooms_wild']]];
          const made = {};
          for (const [label, sp, codes] of species) {
            const id = await mk(ownerP.token, { name: `Verify M6 ${label}`, species: sp, gender: 'male', dateOfBirth: iso(-900) }, sp === 'Horse' ? 450 : sp === 'Pig' ? 90 : sp === 'Chicken' ? 2 : 20);
            made[sp] = id;
            if (!id) continue;
            const ov = await http('GET', `${apiBase}/nutrition/animals/${id}`, null, ownerP.token);
            const list = ov.json?.data?.unsafeFoods || [];
            for (const c of codes) {
              const row = list.find(u => u.code === c);
              if (!row) problems.push(`[6 safe foods] the ${sp} safe-food list is missing '${c}' (has ${list.map(u => u.code).join(', ')})`);
              else if (row.status !== 'unvalidated') problems.push(`[6 safe foods] '${c}' for ${sp} should be status 'unvalidated' (not yet signed off by a vet), got '${row.status}'`);
            }
          }
          const dbRows = rows(`SELECT code, species_code, status FROM ${S}.nutrition_unsafe_foods WHERE code IN ('urea_nonruminant','oleander','lawn_clippings','chocolate_bird','dough_raw','mushrooms_wild','onion_bird','cottonseed_cake','mustard_cake')`);
          const notUnvalidated = dbRows.filter(r => r.status !== 'unvalidated');
          if (notUnvalidated.length) problems.push(`[6 safe foods] new migration-070 rows that are not 'unvalidated': ${notUnvalidated.map(r => `${r.code}/${r.species_code}=${r.status}`).join(', ')}`);
          // a plan / feeding entry that includes the danger is caught
          if (made.Pig) {
            const r = await http('POST', `${apiBase}/nutrition/animals/${made.Pig}/plan`, { goal: 'maintain', mealsPerDay: 2, foods: [{ label: 'Urea mixed feed', kcalPer100g: 300, sharePct: 100 }] }, ownerP.token);
            if (!(r.status === 400 && /unsafe/i.test(msgOf(r)))) {
              const f = await http('POST', `${apiBase}/nutrition/animals/${made.Pig}/feeding`, { label: 'urea', kind: 'meal', amountG: 100 }, ownerP.token);
              if (!(f.json?.data?.warnings || []).length) problems.push(`[6 safe foods] urea given to a pig is neither refused in a plan (HTTP ${r.status} '${msgOf(r).slice(0, 80)}') nor warned when logged (HTTP ${f.status})`);
              else notes.push(`pig plan with urea answered HTTP ${r.status} '${msgOf(r).slice(0, 80)}', but logging urea as fed is flagged`);
            }
          }
          if (made.Chicken) {
            const f = await http('POST', `${apiBase}/nutrition/animals/${made.Chicken}/feeding`, { label: 'chocolate biscuit', kind: 'treat', amountG: 5 }, ownerP.token);
            if (f.status !== 201 || !(f.json?.data?.warnings || []).some(w => w.severity === 'danger')) problems.push(`[6 safe foods] chocolate logged for a chicken was not flagged as a danger (HTTP ${f.status})`);
          }
          if (made.Dog) {
            for (const food of ['raw dough', 'wild mushrooms']) {
              const f = await http('POST', `${apiBase}/nutrition/animals/${made.Dog}/feeding`, { label: food, kind: 'treat', amountG: 20 }, ownerP.token);
              if (f.status !== 201 || !(f.json?.data?.warnings || []).some(w => w.severity === 'danger')) problems.push(`[6 safe foods] '${food}' logged for a dog was not flagged as a danger (HTTP ${f.status})`);
            }
          }
          if (made.Horse) {
            const f = await http('POST', `${apiBase}/nutrition/animals/${made.Horse}/feeding`, { label: 'oleander leaves (kaner)', kind: 'meal', amountG: 200 }, ownerP.token);
            if (f.status !== 201 || !(f.json?.data?.warnings || []).some(w => w.severity === 'danger')) problems.push(`[6 safe foods] oleander logged for a horse was not flagged as a danger (HTTP ${f.status})`);
            const hf = await foodMap(`animalId=${made.Horse}`, ownerP.token);
            const oleanderFeed = Object.entries(hf).find(([k]) => /oleander|urea/i.test(k));
            if (oleanderFeed) problems.push(`[6 safe foods] the horse feed library offers '${oleanderFeed[0]}'`);
            else notes.push('ration builders take library feeds only (no free-typed feed), so oleander / urea cannot enter a horse or pig RATION; the danger is caught on the pet plan route and the feeding log');
          }
        }

        // ═══ 7. WHOLE-MODULE ACCESS (H15) ═══
        {
          const dogAcc = await mk(ownerP.token, { name: 'Verify M7 Dog', species: 'Dog', gender: 'male', dateOfBirth: iso(-1800) }, 20);
          const cowAcc = await mk(tom.token, { name: 'Verify M7 Farm Cow', species: 'Cattle', gender: 'female', dateOfBirth: iso(-365 * 5), enterpriseId: ent }, 400);
          if (dogAcc && cowAcc) {
            book(vetB.id, ownerP.id, 'animal_id', dogAcc, false);
            book(vetB.id, tom.id, 'animal_id', cowAcc, true);
            await http('PATCH', `${apiBase}/nutrition/animals/${dogAcc}/facts`, { isNeutered: true, activityLevel: 'moderate', housing: 'indoor' }, ownerP.token);
            const dPlan = { goal: 'maintain', mealsPerDay: 2, foods: [{ label: 'Verify access kibble', kcalPer100g: 350, sharePct: 100 }] };
            fx.dogId = dogAcc; fx.cowId = cowAcc;
            const dp = await http('POST', `${apiBase}/nutrition/animals/${dogAcc}/plan`, dPlan, ownerP.token);
            const dogPlanId = dp.json?.data?.id;
            await http('POST', `${apiBase}/nutrition/animals/${dogAcc}/measurements`, { weight: 30, unit: 'kg', bodyConditionScore: 9, bcsScale: 9 }, ownerP.token);
            const dogFlag = (await http('GET', `${apiBase}/nutrition/animals/${dogAcc}`, null, ownerP.token)).json?.data?.flags?.[0]?.id;
            const meal1 = (await http('POST', `${apiBase}/nutrition/animals/${dogAcc}/feeding`, { label: 'kibble', kind: 'meal', amountG: 100 }, ownerP.token)).json?.data?.id;
            const fm = await foodMap(`animalId=${cowAcc}`, tom.token);
            const cp = await http('POST', `${apiBase}/nutrition/animals/${cowAcc}/ration`, cowBody(fm, 10), tom.token);
            const cowPlanId = cp.json?.data?.id;
            if (!dogPlanId || !dogFlag || !meal1 || !cowPlanId) problems.push(`[7 access] fixtures not ready: dog plan ${!!dogPlanId}, flag ${!!dogFlag}, meal ${!!meal1}, cow ration ${!!cowPlanId} (${msgOf(cp).slice(0, 80)})`);
            else {
              const P = { owner: ownerP, tom, worker, viewer, vetB, vetU, stranger, hs, pharm, admin };
              const run = async (label, method, path, body, allow, subjectNote) => {
                for (const [name, u] of Object.entries(P)) {
                  const r = await http(method, `${apiBase}${path}`, body, u.token);
                  if (allow.includes(name)) {
                    if (r.status >= 300) problems.push(`[7 access] ${label}: ${name} should be allowed but got HTTP ${r.status} ${codeOf(r)} '${msgOf(r).slice(0, 90)}'`);
                  } else refusal(`[7 access] ${label}: ${name} must be refused`, r);
                }
              };
              // pet dog: owner + booked vet + admin may read and write; reviewing is a vet's job
              const petRW = ['owner', 'vetB', 'admin'];
              await run('GET dog overview', 'GET', `/nutrition/animals/${dogAcc}`, null, petRW);
              await run('GET dog feeding', 'GET', `/nutrition/animals/${dogAcc}/feeding`, null, petRW);
              await run('GET dog foods', 'GET', `/nutrition/foods?animalId=${dogAcc}`, null, petRW);
              await run('POST dog plan preview', 'POST', `/nutrition/animals/${dogAcc}/plan/preview`, dPlan, petRW);
              await run('POST explain dog plan', 'POST', `/nutrition/plans/${dogPlanId}/explain`, { language: 'en' }, petRW);
              await run('POST review dog plan', 'POST', `/nutrition/plans/${dogPlanId}/review`, { note: 'ok' }, ['vetB', 'admin']);
              for (const name of ['owner', 'vetU', 'stranger', 'hs', 'pharm']) {
                refusal(`[7 access] prescribe the dog plan as ${name}`, await http('POST', `${apiBase}/nutrition/plans/${dogPlanId}/prescribe`, { durationDays: 10 }, P[name].token));
              }
              await run('PATCH dog flag', 'PATCH', `/nutrition/flags/${dogFlag}`, { status: 'reviewed' }, petRW);
              await run('PATCH dog facts', 'PATCH', `/nutrition/animals/${dogAcc}/facts`, { activityLevel: 'moderate' }, petRW);
              await run('POST dog measurement', 'POST', `/nutrition/animals/${dogAcc}/measurements`, { weight: 20.5, unit: 'kg' }, petRW);
              await run('POST dog feeding', 'POST', `/nutrition/animals/${dogAcc}/feeding`, { label: 'kibble', kind: 'meal', amountG: 80 }, petRW);
              await run('POST dog food', 'POST', '/nutrition/foods', { animalId: dogAcc, label: 'Verify access treat', kcalPer100g: 300, kind: 'treat' }, petRW);
              for (const name of ['viewer', 'stranger', 'vetU', 'hs', 'pharm']) {
                refusal(`[7 access] delete another person's dog meal as ${name}`, await http('DELETE', `${apiBase}/nutrition/feeding/${meal1}`, null, P[name].token));
              }
              if ((await http('DELETE', `${apiBase}/nutrition/feeding/${meal1}`, null, ownerP.token)).status >= 300) problems.push('[7 access] the owner could not delete their own meal entry');
              await run('POST dog plan', 'POST', `/nutrition/animals/${dogAcc}/plan`, dPlan, petRW);

              // farm cow: owner, worker, manager-less here; viewer read-only; booked vet read+write; admin all
              const farmRead = ['tom', 'worker', 'viewer', 'vetB', 'admin'];
              const farmWrite = ['tom', 'worker', 'vetB', 'admin'];
              await run('GET cow overview', 'GET', `/nutrition/animals/${cowAcc}`, null, farmRead);
              await run('GET cow feeding', 'GET', `/nutrition/animals/${cowAcc}/feeding`, null, farmRead);
              await run('GET cow foods', 'GET', `/nutrition/foods?animalId=${cowAcc}`, null, farmRead);
              await run('POST cow ration preview', 'POST', `/nutrition/animals/${cowAcc}/ration/preview`, cowBody(fm, 10), farmRead);
              await run('POST explain cow ration', 'POST', `/nutrition/plans/${cowPlanId}/explain`, { language: 'en' }, farmRead);
              await run('POST review cow ration', 'POST', `/nutrition/plans/${cowPlanId}/review`, { note: 'ok' }, ['vetB', 'admin']);
              await run('POST cow measurement', 'POST', `/nutrition/animals/${cowAcc}/measurements`, { weight: 401, unit: 'kg' }, farmWrite);
              await run('PATCH cow facts', 'PATCH', `/nutrition/animals/${cowAcc}/facts`, { activityLevel: 'moderate' }, farmWrite);
              await run('POST cow feeding', 'POST', `/nutrition/animals/${cowAcc}/feeding`, { label: 'green maize', kind: 'meal', amountG: 5000 }, farmWrite);
              await run('POST cow ration', 'POST', `/nutrition/animals/${cowAcc}/ration`, cowBody(fm, 10), farmWrite);
              // herd
              const gf = await foodMap(`groupId=${herd}`, tom.token);
              const herdBody = { milkLitresPerDay: 8, avgWeightKg: 400, feeds: COW_FEEDS.map((c, i) => ({ ingredientId: gf[c], pricePerKg: COW_PRICE[i] })) };
              const herdRead = ['tom', 'worker', 'viewer', 'admin'];
              await run('GET herd ration', 'GET', `/nutrition/groups/${herd}/ration`, null, herdRead);
              await run('GET herd feeding card', 'GET', `/nutrition/groups/${herd}/feeding`, null, herdRead);
              await run('GET herd foods', 'GET', `/nutrition/foods?groupId=${herd}`, null, herdRead);
              await run('POST herd ration preview', 'POST', `/nutrition/groups/${herd}/ration/preview`, herdBody, herdRead);
              await run('POST herd ration', 'POST', `/nutrition/groups/${herd}/ration`, herdBody, ['tom', 'worker', 'admin']);
              // admin master data: admin only
              for (const p of ['species', 'energy-factors', 'foods', 'unsafe-foods', 'requirement-sets', 'curves', 'usage?days=30']) {
                await run(`GET /nutrition/admin/${p}`, 'GET', `/nutrition/admin/${p}`, null, ['admin']);
              }
              for (const name of ['owner', 'tom', 'worker', 'vetB', 'vetU', 'hs', 'pharm', 'stranger']) {
                refusal(`[7 access] approve-pending master data as ${name}`, await http('POST', `${apiBase}/nutrition/admin/approve-pending`, null, P[name].token));
                refusal(`[7 access] change a species model as ${name}`, await http('PUT', `${apiBase}/nutrition/admin/species/Dog`, { nutritionModel: 'guidance_only' }, P[name].token));
              }
              // lists and the dashboard follow the same rule
              for (const [name, u] of Object.entries({ stranger, vetU, hs, pharm })) {
                const l = await http('GET', `${apiBase}/nutrition/animals?limit=100`, null, u.token);
                const ids = (l.json?.data?.items || []).map(x => x.id);
                if (ids.includes(dogAcc) || ids.includes(cowAcc)) problems.push(`[7 access] ${name} sees another person's animal in the Nutrition list`);
                const sm = await http('GET', `${apiBase}/nutrition/summary`, null, u.token);
                if (sm.json?.data?.total !== 0) problems.push(`[7 access] ${name}'s dashboard counts ${sm.json?.data?.total} animal(s) that are not theirs`);
              }
              for (const [name, u] of Object.entries({ worker, viewer, vetB })) {
                const l = await http('GET', `${apiBase}/nutrition/animals?limit=100`, null, u.token);
                if (!(l.json?.data?.items || []).some(x => x.id === cowAcc)) problems.push(`[7 access] ${name} cannot find the farm cow they may open in the Nutrition list`);
              }
              // a stranger with a made-up id vs a real one: same words?
              const real = await http('GET', `${apiBase}/nutrition/groups/${herd}/feeding`, null, stranger.token);
              const fake = await http('GET', `${apiBase}/nutrition/groups/${uuid()}/feeding`, null, stranger.token);
              if (real.status !== fake.status) notes.push(`group ids: a stranger gets HTTP ${real.status} for a real farm's group but HTTP ${fake.status} for an unknown id - this confirms the group exists (owner decision needed on revealing it, CLAUDE.md H15 note)`);
              const realA = await http('GET', `${apiBase}/nutrition/animals/${dogAcc}`, null, stranger.token);
              const fakeA = await http('GET', `${apiBase}/nutrition/animals/${uuid()}`, null, stranger.token);
              if (realA.status !== fakeA.status) notes.push(`animal ids: a stranger gets HTTP ${realA.status} for a real animal but HTTP ${fakeA.status} for an unknown id - the real one's existence can be told apart`);
            }
          }
        }

        // ═══ 8. CONNECTIONS ═══
        {
          // 8a feed recorded in Daily records lowers stock and shows in cost
          const feedPath = `${apiBase}/enterprises/${ent}/feed`;
          const item = await http('POST', feedPath, { feedName: 'Verify M8 feed', unit: 'kg', currentStock: 300, minimumStock: 10, costPerUnit: 10 }, tom.token);
          const itemId = item.json?.data?.id;
          const pigs = uuid();
          sql(`INSERT INTO animal_groups (id, enterprise_id, name, species, current_count) VALUES ('${pigs}', '${ent}', 'Verify M8 Pigs', 'Pig', 10);
               INSERT INTO group_cycles (group_id, cycle_number, species, placed_count, current_count, started_at, status) VALUES ('${pigs}', 1, 'Pig', 10, 10, CURRENT_DATE - 90, 'active');`);
          if (!itemId) problems.push(`[8 connections] could not create a stock item: HTTP ${item.status} ${msgOf(item).slice(0, 100)}`);
          else {
            const before = Number((await http('GET', `${apiBase}/nutrition/summary`, null, tom.token)).json?.data?.feedCostToday || 0);
            const rec = await http('POST', `${apiBase}/farm-records`, { enterpriseId: ent, recordType: 'feed', groupId: pigs, quantity: 25, feedId: itemId }, tom.token);
            const stock = ((await http('GET', feedPath, null, tom.token)).json?.data?.items || []).find(f => f.id === itemId);
            if (rec.status >= 300 || stock?.currentStock !== 275 || rec.json?.data?.cost !== 250) problems.push(`[8 connections] recording 25 kg of a 10-per-kg stock item: HTTP ${rec.status}, stock ${stock?.currentStock} (want 275), cost ${rec.json?.data?.cost} (want 250)`);
            const after = Number((await http('GET', `${apiBase}/nutrition/summary`, null, tom.token)).json?.data?.feedCostToday || 0);
            if (Math.abs(after - before - 250) > 0.01) problems.push(`[8 connections] the dashboard's feed cost today went ${before} -> ${after}, expected +250 from the recorded feed`);
            const card = await http('GET', `${apiBase}/nutrition/groups/${pigs}/feeding`, null, tom.token);
            const t = card.json?.data?.today;
            if (card.status !== 200 || t?.status !== 'ok' || !(t?.costPerDay > 0) || Math.abs(t.costPerDay - t.kgPerDay * 10) > 0.2) problems.push(`[8 connections] the pig group's feed card should price today's feed at the recorded stock price (10 per kg): HTTP ${card.status}, kg ${t?.kgPerDay}, cost ${t?.costPerDay}`);
            for (const [who, tok] of [['worker', worker.token], ['viewer', viewer.token], ['admin', admin.token]]) {
              const c2 = await http('GET', `${apiBase}/nutrition/groups/${pigs}/feeding`, null, tok);
              if (c2.json?.data?.today?.costPerDay !== t?.costPerDay) problems.push(`[8 connections] the pig card shows ${c2.json?.data?.today?.costPerDay} to the ${who} but ${t?.costPerDay} to the farmer`);
            }
            const sFarmer = await http('GET', `${apiBase}/nutrition/summary`, null, tom.token);
            const sWorker = await http('GET', `${apiBase}/nutrition/summary`, null, worker.token);
            if (sWorker.json?.data?.feedCostToday !== sFarmer.json?.data?.feedCostToday) problems.push(`[8 connections] the farm's feed cost today differs: farmer ${sFarmer.json?.data?.feedCostToday}, worker ${sWorker.json?.data?.feedCostToday}`);
            const strangerCost = (await http('GET', `${apiBase}/nutrition/summary`, null, stranger.token)).json?.data?.feedCostToday;
            if (strangerCost !== null && strangerCost !== undefined) problems.push(`[8 connections] a stranger's dashboard shows a feed cost today (${strangerCost})`);
          }
          // 8b medicated-feed prescription: the ration carries the one withdrawal answer
          const wCow = await mk(tom.token, { name: 'Verify M8 Withdrawal Cow', species: 'Cattle', gender: 'female', dateOfBirth: iso(-365 * 5), enterpriseId: ent }, 400);
          if (wCow) {
            const rx = await http('POST', `${apiBase}/prescriptions`, { petOwnerId: tom.id, animalId: wCow, diagnosis: 'Verify', instructions: '', medications: [{ name: 'Verify medicated feed', dosage: '5 ml', frequency: 'Once daily', treatmentDays: 2, withdrawalMilkDays: 3, withdrawalMeatDays: 10 }] }, admin.token);
            const fm = await foodMap(`animalId=${wCow}`, tom.token);
            const pv = await http('POST', `${apiBase}/nutrition/animals/${wCow}/ration/preview`, cowBody(fm, 10), tom.token);
            const wd = (await http('GET', `${apiBase}/animals/${wCow}/withdrawal`, null, tom.token)).json?.data;
            const got = pv.json?.data?.withdrawals;
            if (rx.status !== 201) problems.push(`[8 connections] medicated prescription for the cow: HTTP ${rx.status} ${msgOf(rx).slice(0, 100)}`);
            else if (!Array.isArray(got) || got.find(w => w.what === 'milk')?.until !== wd?.milkUntil || got.find(w => w.what === 'meat')?.until !== wd?.meatUntil || !wd?.milkUntil) problems.push(`[8 connections] the ration's withdrawals ${JSON.stringify(got)} must equal the withdrawal service's answer (milk ${wd?.milkUntil}, meat ${wd?.meatUntil})`);
            const none = await http('POST', `${apiBase}/nutrition/animals/${wCow}/ration/preview`, cowBody(fm, 10), vetB.token);
            if (none.status < 400) problems.push('[8 connections] an unbooked vet previewed a farm cow\'s ration (and its withdrawals)');
          }
          // 8c sold animal (recorded as a sale in Daily records, the real path): plan archived at once
          const sold = await mk(tom.token, { name: 'Verify M8 Sold Cow', species: 'Cattle', gender: 'female', dateOfBirth: iso(-365 * 5), enterpriseId: ent }, 400);
          if (sold) {
            const fm = await foodMap(`animalId=${sold}`, tom.token);
            const rs = await http('POST', `${apiBase}/nutrition/animals/${sold}/ration`, cowBody(fm, 10), tom.token);
            const planState = () => rows(`SELECT status FROM ${S}.nutrition_plans WHERE animal_id = '${sold}' ORDER BY created_at DESC LIMIT 1`)[0]?.status;
            if (rs.status !== 201 || planState() !== 'active') problems.push(`[8 connections] could not set up the sold-animal plan (HTTP ${rs.status}, state ${planState()})`);
            const sale = await http('POST', `${apiBase}/farm-records/events`, { animalId: sold, eventType: 'sale', eventDate: iso(0), detail: { amount: 40000 } }, tom.token);
            if (sale.status >= 300) problems.push(`[8 connections] recording the sale of the cow: HTTP ${sale.status} ${codeOf(sale)} ${msgOf(sale).slice(0, 120)}`);
            else if (planState() !== 'archived') problems.push(`[8 connections] after the sale the cow's plan should be archived, it is '${planState()}'`);
            const ovSold = await http('GET', `${apiBase}/nutrition/animals/${sold}`, null, tom.token);
            if (ovSold.json?.data?.plan) problems.push('[8 connections] a sold animal still shows a plan in its Nutrition panel');
            const lst = await http('GET', `${apiBase}/nutrition/animals?limit=100`, null, tom.token);
            const row = (lst.json?.data?.items || []).find(x => x.id === sold);
            if (row?.plan) problems.push('[8 connections] a sold animal still shows a plan in the Nutrition list');
          }
          // 8d notifications of a feeding alert: owner, farm managers and connected vets; not a stranger
          const farmDog = await mk(tom.token, { name: 'Verify M8 Farm Dog', species: 'Dog', gender: 'male', dateOfBirth: iso(-1800), enterpriseId: ent }, 30);
          if (farmDog) {
            book(vetB.id, tom.id, 'animal_id', farmDog, true);
            await http('PATCH', `${apiBase}/nutrition/animals/${farmDog}/facts`, { isNeutered: true, activityLevel: 'moderate', housing: 'indoor' }, tom.token);
            await http('POST', `${apiBase}/nutrition/animals/${farmDog}/measurements`, { weight: 30, unit: 'kg', bodyConditionScore: 9, bcsScale: 9 }, tom.token);
            const flags = (await http('GET', `${apiBase}/nutrition/animals/${farmDog}`, null, tom.token)).json?.data?.flags || [];
            if (!flags.length) problems.push('[8 connections] a body condition of 9/9 raised no alert');
            const mine = (u) => rows(`SELECT metadata->>'dedupeKey' AS dk FROM ${S}.notifications WHERE user_id = '${u.id}' AND metadata->>'type' = 'nutrition_flag' AND metadata->>'animalId' = '${farmDog}'`);
            for (const [who, u] of [['farm owner', tom], ['farm manager', mgr], ['connected vet', vetB]]) {
              const m = mine(u);
              if (m.length === 0) problems.push(`[8 connections] the ${who} got no notification for the feeding alert`);
              else if (new Set(m.map(x => x.dk)).size !== m.length) problems.push(`[8 connections] the ${who} was told about the same alert more than once (${m.length} notes, ${new Set(m.map(x => x.dk)).size} distinct)`);
            }
            for (const [who, u] of [['stranger', stranger], ['unbooked vet', vetU], ['hospital staff', hs], ['pharmacist', pharm]]) {
              if (mine(u).length) problems.push(`[8 connections] the ${who} was notified about another person's animal`);
            }
            notes.push(`feeding-alert notifications: farm worker ${mine(worker).length}, farm viewer ${mine(viewer).length} (by design only owner / manager / supervisor and connected vets are told)`);
          }
          // 8e the assistant builds its context on the real schema (the AI itself is not called)
          const dogCtx = await mk(ownerP.token, { name: 'Verify M8 Context Dog', species: 'Dog', gender: 'male', dateOfBirth: iso(-1800) }, 20);
          if (dogCtx) {
            await http('PATCH', `${apiBase}/nutrition/animals/${dogCtx}/facts`, { isNeutered: true, activityLevel: 'moderate', housing: 'indoor' }, ownerP.token);
            await http('POST', `${apiBase}/nutrition/animals/${dogCtx}/plan`, { goal: 'maintain', mealsPerDay: 2, foods: [{ label: 'Verify ctx kibble', kcalPer100g: 350, sharePct: 100 }] }, ownerP.token);
            const logMark = serverLog.length;
            const sess = await http('POST', `${apiBase}/ai-copilot/sessions`, { title: 'verify 6m' }, ownerP.token);
            const sid = sess.json?.data?.id || sess.json?.data?.session?.id;
            const sent = sid ? await http('POST', `${apiBase}/ai-copilot/sessions/${sid}/messages`, { content: 'What should Verify M8 Context Dog eat?' }, ownerP.token) : sess;
            const ctxFail = serverLog.slice(logMark).split('\n').filter(l => /Failed to build user context for AI/.test(l));
            if (!sid || sent.status >= 400) problems.push(`[8 connections] the assistant did not answer the owner: session HTTP ${sess.status}, message HTTP ${sent.status}`);
            else if (ctxFail.length) problems.push('[8 connections] the assistant could not build the owner\'s context with a nutrition plan on the animal');
            else notes.push('assistant context builds without error with a plan on the animal; whether the plan text reaches the model is not observable over HTTP (the context string is internal; AI calls are off here)');
          }
        }

        // ═══ 9. MILK YIELD ONE-PLACE CHECK (report only) ═══
        {
          const mc = await mk(tom.token, { name: 'Verify M9 Milk Cow', species: 'Cattle', gender: 'female', dateOfBirth: iso(-365 * 5), enterpriseId: ent, avgDailyMilkLitres: 5 }, 450);
          if (mc) {
            const fm = await foodMap(`animalId=${mc}`, tom.token);
            const noMilkBody = { feeds: COW_FEEDS.map((c, i) => ({ ingredientId: fm[c], pricePerKg: COW_PRICE[i] })) };
            const typed = (await http('POST', `${apiBase}/nutrition/animals/${mc}/ration/preview`, noMilkBody, tom.token)).json?.data;
            for (let d = 1; d <= 3; d++) await http('POST', `${apiBase}/farm-records`, { enterpriseId: ent, recordType: 'milk', animalId: mc, quantity: 9, session: 'am', recordDate: iso(-d) }, tom.token);
            const recMilk = Number(rows(`SELECT COALESCE(SUM(quantity), 0) AS n FROM ${S}.farm_daily_records WHERE animal_id = '${mc}' AND record_type = 'milk'`)[0]?.n);
            const afterRec = (await http('POST', `${apiBase}/nutrition/animals/${mc}/ration/preview`, noMilkBody, tom.token)).json?.data;
            const typedOver = (await http('POST', `${apiBase}/nutrition/animals/${mc}/ration/preview`, { ...noMilkBody, milkLitresPerDay: 20 }, tom.token)).json?.data;
            const profileNow = Number(rows(`SELECT avg_daily_milk_litres AS v FROM ${S}.animals WHERE id = '${mc}'`)[0]?.v);
            await http('POST', `${apiBase}/nutrition/animals/${mc}/ration`, { ...noMilkBody, milkLitresPerDay: 20 }, tom.token);
            const profileAfterSave = Number(rows(`SELECT avg_daily_milk_litres AS v FROM ${S}.animals WHERE id = '${mc}'`)[0]?.v);
            notes.push(`MILK YIELD: profile avg typed 5 L; ration preview with no recorded milk used ${typed?.milkLitresPerDay} L (source ${typed?.milkSource}); after ${recMilk} L of milk recorded in Daily records over 3 days (9 L/day) the preview used ${afterRec?.milkLitresPerDay} L (source ${afterRec?.milkSource}); a typed 20 L in the ration form was used as ${typedOver?.milkLitresPerDay} L; the profile avg_daily_milk_litres stayed ${profileNow} until the ration was SAVED with 20 L, then became ${profileAfterSave} (the typed value is written back to the profile, so the profile can drift from the recorded 9 L/day)`);
          }
        }
      }
      const sqlErrs = serverLog.slice(mark).split('\n')
        .filter(l => /syntax error|does not exist|violates|invalid input syntax|there is no unique|could not determine|DATABASE_ERROR|statusCode":5\d\d/i.test(l))
        .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').slice(-240));
      if (notes.length) log(`   PHASE 6m notes:\n     - ${notes.join('\n     - ')}`);
      if (problems.length || sqlErrs.length) fail('Animal nutrition misbehaves end to end (weight, age gate, home diet, caution, metabolic gate, safe foods, access, connections).', [...problems, ...sqlErrs]);
      else ok('one weight; no adult ration without an age; home-only diet; breeder caution; metabolic gate; safe-food gaps; whole-module access; feed/withdrawal/sale/notification connections');
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
            env: { ...process.env, E2E_BASE_URL: `http://127.0.0.1:${port}`, CI: '1', SWEEP_ACCOUNTS: JSON.stringify(sweepAccounts), NUTRI_FIXTURES: JSON.stringify(globalThis.__nutriFixtures || null) },
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
