#!/usr/bin/env node
/**
 * Runtime test for the grooming slot engine (migration 037).
 * ─────────────────────────────────────────────────────────
 * `tsc` proves the slot maths compiles; it cannot prove that a 120-minute booking at 10:00
 * actually blocks 11:00, that a salon with two tables sells the same hour twice, or that a
 * cancelled order gives the station back. All of that is SQL + arithmetic against real rows,
 * so it needs a real database.
 *
 * Spins a throwaway PostgreSQL, applies docker/init.sql plus every migration, seeds one
 * provider / service / weekly schedule, then drives GroomingScheduleService directly.
 *
 * Run: npm run verify:slots   (from backend/; requires a local PostgreSQL, or set PGBIN)
 *
 * Kept separate from verify:runtime deliberately — that gate proves the SCHEMA survives a real
 * boot; this one proves the booking LOGIC on top of it is correct.
 */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '..', '..');

function findPgBin() {
  if (process.env.PGBIN) return process.env.PGBIN;
  const exe = process.platform === 'win32' ? 'initdb.exe' : 'initdb';
  const candidates = process.platform === 'win32'
    ? ['C:\\Program Files\\PostgreSQL\\18\\bin', 'C:\\Program Files\\PostgreSQL\\17\\bin',
       'C:\\Program Files\\PostgreSQL\\16\\bin', 'E:\\Program Files\\PostgreSQL\\18\\bin']
    : ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/local/bin', '/usr/bin'];
  return candidates.find(c => fs.existsSync(path.join(c, exe))) || null;
}
const PGBIN = findPgBin();
if (!PGBIN) {
  console.error('\x1b[31mNo local PostgreSQL found.\x1b[0m Install it, or point PGBIN at its bin directory.');
  process.exit(1);
}
const pg = n => path.join(PGBIN, process.platform === 'win32' ? `${n}.exe` : n);
const SCHEMA = 'vetcare_dev';
let PORT = 0;

function freePort() {
  return new Promise(res => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function run(cmd, args, opts = {}) {
  return execFileSync(pg(cmd), args, { encoding: 'utf8', stdio: 'pipe', ...opts });
}
function psql(db, sql, singleTx) {
  const args = ['-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1'];
  if (singleTx) args.push('--single-transaction');
  args.push('-c', sql);
  return run('psql', args);
}
function psqlFile(db, file) {
  return run('psql', ['-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', file]);
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.log(`  \x1b[31m✗ ${name}\x1b[0m${detail ? ` — ${detail}` : ''}`); }
}

(async () => {
  PORT = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slotpg-'));
  const dataPath = path.join(dir, 'data');
  console.log(`\n━━━ Grooming slot-engine runtime test (port ${PORT}) ━━━\n`);
  run('initdb', ['-D', dataPath, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8'], { stdio: 'ignore' });

  const server = spawn(pg('postgres'), ['-D', dataPath, '-p', String(PORT), '-h', '127.0.0.1'],
    { stdio: 'ignore', detached: false });

  const stop = () => { try { server.kill('SIGKILL'); } catch {} };
  process.on('exit', stop);

  // wait for readiness
  for (let i = 0; i < 60; i++) {
    try { run('pg_isready', ['-h', '127.0.0.1', '-p', String(PORT)], { stdio: 'ignore' }); break; }
    catch { await new Promise(r => setTimeout(r, 500)); }
  }

  try {
    run('createdb', ['-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', 'verifydb']);
    psql('verifydb', `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}; ALTER DATABASE verifydb SET search_path TO ${SCHEMA};`);
    psql('verifydb', `ALTER ROLE postgres SET search_path TO ${SCHEMA};`);
    psqlFile('verifydb', path.join(ROOT, 'docker', 'init.sql'));
    const migDir = path.join(ROOT, 'backend', 'migrations');
    for (const f of fs.readdirSync(migDir).filter(x => x.endsWith('.sql')).sort()) {
      psqlFile('verifydb', path.join(migDir, f));
    }
    console.log('  schema ready (init.sql + migrations)\n');

    // ── seed a provider, service and schedule ──
    psql('verifydb', `
      INSERT INTO users (id, email, password_hash, first_name, last_name, role)
      VALUES ('11111111-1111-1111-1111-111111111111','groomer@test.local','x','G','One','groomer'),
             ('22222222-2222-2222-2222-222222222222','cust@test.local','x','C','Two','pet_owner');

      INSERT INTO grooming_providers (id, owner_user_id, business_name, verification_status, is_paused)
      VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',
              'Test Spa','verified',false);

      -- 120-minute service: long enough that overlap behaviour is visible on a 30-min grid
      INSERT INTO grooming_services (id, provider_id, name, base_price, duration_minutes, is_active)
      VALUES ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333',
              'Full Groom', 1000, 120, true);

      -- Wednesday (day_of_week 3), 09:00-18:00, 30-min grid, TWO stations
      INSERT INTO grooming_schedules (provider_id, day_of_week, open_time, close_time, slot_interval_minutes, capacity)
      VALUES ('33333333-3333-3333-3333-333333333333', 3, '09:00','18:00',30,2);
    `);

    // Individual params, NOT DATABASE_URL: config forces SSL whenever DATABASE_URL is set,
    // and a local trust cluster rejects SSL (same reason runtime-verify.js does this).
    process.env.DATABASE_URL = '';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = String(PORT);
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = '';
    process.env.DB_NAME = 'verifydb';
    process.env.DB_SCHEMA = SCHEMA;
    process.env.MOCK_DB = 'false';
    process.env.MOCK_REDIS = 'true';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';

    const svc = require(path.join(ROOT, 'backend', 'dist', 'services', 'grooming', 'GroomingScheduleService')).default;
    const db = require(path.join(ROOT, 'backend', 'dist', 'utils', 'database')).default;

    // Pick a Wednesday comfortably in the future so "today" filtering never interferes.
    const d = new Date(); d.setDate(d.getDate() + 14);
    while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
    const DATE = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    console.log(`  test date ${DATE} (Wednesday)\n`);

    const P = '33333333-3333-3333-3333-333333333333';
    const S = '44444444-4444-4444-4444-444444444444';

    // 1. baseline — 120-min service on a 09:00-18:00 day, 30-min grid
    let a = await svc.getAvailability(P, DATE, { serviceId: S });
    check('open day yields slots', a.slots.length > 0, `got ${a.slots.length}`);
    check('first slot is 09:00', a.slots[0]?.startTime === '09:00', a.slots[0]?.startTime);
    check('slot end reflects 120-min service', a.slots[0]?.endTime === '11:00', a.slots[0]?.endTime);
    check('last slot ends by closing time',
      a.slots[a.slots.length - 1]?.endTime === '18:00', a.slots[a.slots.length - 1]?.endTime);
    check('capacity reported', a.capacity === 2, String(a.capacity));

    // 2. closed day — Sunday has no schedule row
    const sun = new Date(d); sun.setDate(sun.getDate() + 4); // Wed +4 = Sunday
    const SUN = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
    a = await svc.getAvailability(P, SUN, { serviceId: S });
    check('closed weekday yields no slots with a reason',
      a.slots.length === 0 && !!a.closedReason, a.closedReason);

    // 3. one booking at 10:00 (10:00-12:00) — capacity 2, so still bookable
    await db.query(`INSERT INTO grooming_orders
      (order_number, pet_owner_id, provider_id, primary_service_id, scheduled_date, time_slot_start,
       duration_minutes, status)
      VALUES ('GRM-T-1','22222222-2222-2222-2222-222222222222',$1,$2,$3,'10:00',120,'confirmed')`, [P, S, DATE]);
    a = await svc.getAvailability(P, DATE, { serviceId: S });
    let s10 = a.slots.find(x => x.startTime === '10:00');
    check('1 of 2 stations busy → still available', s10?.isAvailable === true);
    check('remaining capacity drops to 1', s10?.remainingCapacity === 1, String(s10?.remainingCapacity));

    // overlap must affect neighbours, not just the exact start time
    let s11 = a.slots.find(x => x.startTime === '11:00');
    check('overlapping 11:00 also sees the 10:00-12:00 booking',
      s11?.remainingCapacity === 1, String(s11?.remainingCapacity));
    let s12 = a.slots.find(x => x.startTime === '12:00');
    check('non-overlapping 12:00 is untouched',
      s12?.remainingCapacity === 2, String(s12?.remainingCapacity));

    // 4. second booking at 11:00 → 11:00-13:00. Now 10:00 slot overlaps BOTH.
    await db.query(`INSERT INTO grooming_orders
      (order_number, pet_owner_id, provider_id, primary_service_id, scheduled_date, time_slot_start,
       duration_minutes, status)
      VALUES ('GRM-T-2','22222222-2222-2222-2222-222222222222',$1,$2,$3,'11:00',120,'confirmed')`, [P, S, DATE]);
    a = await svc.getAvailability(P, DATE, { serviceId: S });
    s11 = a.slots.find(x => x.startTime === '11:00');
    check('both stations busy at 11:00 → unavailable', s11?.isAvailable === false);
    check('remaining capacity is 0', s11?.remainingCapacity === 0, String(s11?.remainingCapacity));

    // 5. assertSlotBookable must refuse the full slot and accept a free one
    let refused = false;
    try { await svc.assertSlotBookable(P, DATE, '11:00', { serviceId: S }); }
    catch (e) { refused = /fully booked/i.test(e.message); }
    check('assertSlotBookable rejects a full slot', refused);

    let accepted = 0;
    try { accepted = await svc.assertSlotBookable(P, DATE, '15:00', { serviceId: S }); } catch { /* noop */ }
    check('assertSlotBookable accepts a free slot and returns duration', accepted === 120, String(accepted));

    let offGrid = false;
    try { await svc.assertSlotBookable(P, DATE, '09:07', { serviceId: S }); }
    catch (e) { offGrid = /not a bookable start time/i.test(e.message); }
    check('assertSlotBookable rejects an off-grid time', offGrid);

    let closedDay = false;
    try { await svc.assertSlotBookable(P, SUN, '10:00', { serviceId: S }); }
    catch { closedDay = true; }
    check('assertSlotBookable rejects a closed day', closedDay);

    // 6. cancelled orders must release the station
    await db.query(`UPDATE grooming_orders SET status='cancelled_by_customer' WHERE order_number IN ('GRM-T-1','GRM-T-2')`);
    a = await svc.getAvailability(P, DATE, { serviceId: S });
    s11 = a.slots.find(x => x.startTime === '11:00');
    check('cancelled orders free the slot again', s11?.remainingCapacity === 2, String(s11?.remainingCapacity));

    // 7. blocked range removes the slot entirely
    await svc.createBlockedSlot('11111111-1111-1111-1111-111111111111', P,
      { startTime: '13:00', endTime: '14:00', isRecurring: true, recurringDay: 3, reason: 'Lunch' });
    a = await svc.getAvailability(P, DATE, { serviceId: S });
    check('recurring block removes overlapping start times',
      !a.slots.some(x => x.startTime === '13:00'));

    // 8. date override closes the day
    await svc.saveOverride('11111111-1111-1111-1111-111111111111', P,
      { overrideDate: DATE, overrideType: 'closed', reason: 'Staff training' });
    a = await svc.getAvailability(P, DATE, { serviceId: S });
    check('date override closes the day', a.slots.length === 0 && a.closedReason === 'Staff training', a.closedReason);

    await db.getPool().end();
  } catch (err) {
    failures++;
    console.log(`\n\x1b[31mERROR: ${err.message}\x1b[0m`);
    if (err.stdout) console.log(String(err.stdout).slice(0, 2000));
    if (err.stderr) console.log(String(err.stderr).slice(0, 2000));
  } finally {
    stop();
  }

  console.log(failures === 0
    ? '\n\x1b[32m━━━ SLOT ENGINE: ALL CHECKS PASSED ━━━\x1b[0m\n'
    : `\n\x1b[31m━━━ SLOT ENGINE: ${failures} CHECK(S) FAILED ━━━\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
