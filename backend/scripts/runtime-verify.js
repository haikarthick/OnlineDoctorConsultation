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
