/**
 * Error alerts: technical errors that were hidden from a user must never go unnoticed.
 *
 * - recordSystemError(): called by safeErrorResponse and the global error handler. One row per
 *   distinct problem (signature = status + method + path with ids removed + message with numbers
 *   removed), counted, so a thousand identical failures are one line, not a thousand.
 * - A brand-new 5xx problem triggers an immediate email (at most one per 30 minutes per server).
 * - Once a day (09:00 India time) a digest of everything new or still happening since the last
 *   digest is emailed, and nothing is sent on a quiet day.
 *
 * Recipient: OPS_ALERT_EMAIL (env). Not set = alerts are only logged, never emailed.
 */
import crypto from 'crypto';
import database from '../utils/database';
import logger from '../utils/logger';

const IMMEDIATE_MIN_GAP_MS = 30 * 60 * 1000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
let lastImmediateAt = 0;
let lastDigestDay = '';

export function errorSignature(status: number, method: string, path: string, message: string): string {
  const cleanPath = (path || '').split('?')[0].replace(UUID_RE, ':id').replace(/\/\d+/g, '/:n');
  const cleanMsg = (message || '').replace(UUID_RE, '<id>').replace(/\d+/g, '#').slice(0, 200);
  return crypto.createHash('md5').update(`${status}|${method}|${cleanPath}|${cleanMsg}`).digest('hex');
}

function recipient(): string { return (process.env.OPS_ALERT_EMAIL || '').trim(); }
function envName(): string { return process.env.DB_SCHEMA || process.env.NODE_ENV || 'unknown'; }
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const esc = (s: string) => s.replace(/[&<>]/g, c => ESC[c]);

interface AlertRow { reference: string; status: number; method?: string; path?: string; message: string; occurrences: number }

async function sendMail(subject: string, rows: AlertRow[], intro: string): Promise<void> {
  const to = recipient();
  if (!to) return;
  const EmailService = (await import('./EmailService')).default;
  const lines = rows.map(r =>
    `<tr><td>${esc(String(r.reference))}</td><td>${r.status}</td><td>${esc(`${r.method || ''} ${r.path || ''}`)}</td><td>${r.occurrences}</td><td>${esc(String(r.message).slice(0, 400))}</td></tr>`).join('');
  const html = `<p>${esc(intro)}</p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:13px sans-serif">`
    + `<tr><th>Reference</th><th>Status</th><th>Request</th><th>Times</th><th>What the server said</th></tr>${lines}</table>`
    + '<p style="font:12px sans-serif;color:#666">Full entry: Render dashboard, this service, Logs, search for the reference.</p>';
  const text = `${intro}\n\n` + rows.map(r => `${r.reference}  ${r.status}  ${r.method || ''} ${r.path || ''}  x${r.occurrences}\n  ${String(r.message).slice(0, 400)}`).join('\n');
  await EmailService.send({ to, subject, html, text });
}

export async function recordSystemError(e: { reference: string; status: number; method?: string; path?: string; message: string }): Promise<void> {
  try {
    const sig = errorSignature(e.status, e.method || '', e.path || '', e.message);
    const r = await database.query(
      `INSERT INTO system_error_log (signature, reference, status, method, path, message)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (signature) DO UPDATE SET occurrences = system_error_log.occurrences + 1, last_seen = NOW(), reference = EXCLUDED.reference
       RETURNING occurrences`,
      [sig, e.reference, e.status, (e.method || '').slice(0, 10), (e.path || '').split('?')[0].slice(0, 300), e.message.slice(0, 2000)]);
    const isNew = r.rows?.[0]?.occurrences === 1;
    if (isNew && e.status >= 500 && recipient() && Date.now() - lastImmediateAt > IMMEDIATE_MIN_GAP_MS) {
      lastImmediateAt = Date.now();
      await sendMail(`[${envName()}] NEW server error: ${e.method || ''} ${(e.path || '').split('?')[0]}`,
        [{ reference: e.reference, status: e.status, method: e.method, path: (e.path || '').split('?')[0], message: e.message, occurrences: 1 }],
        'A new kind of server error just happened. Later repeats are counted and included in the daily digest.');
    }
  } catch (err: any) {
    // Recording must never break a request (and never recurse into itself)
    logger.warn('Could not record system error', { error: err.message });
  }
}

/** Called hourly by the scheduler; sends the digest once a day, from 09:00 India time (03:30 UTC). */
export async function runErrorDigest(now: Date = new Date()): Promise<void> {
  try {
    if (!recipient()) return;
    const day = now.toISOString().slice(0, 10);
    if (lastDigestDay === day) return;
    if (now.getUTCHours() * 60 + now.getUTCMinutes() < 3 * 60 + 30) return;
    // Survives a restart: skip if a digest already went out today.
    const done = await database.query('SELECT 1 FROM system_error_log WHERE emailed_at::date = $1::date LIMIT 1', [day]);
    if (done.rows.length) { lastDigestDay = day; return; }
    const { rows } = await database.query(
      `SELECT reference, status, method, path, message, occurrences
         FROM system_error_log WHERE emailed_at IS NULL OR last_seen > emailed_at
        ORDER BY last_seen DESC LIMIT 100`);
    lastDigestDay = day;
    if (!rows.length) return;
    await sendMail(`[${envName()}] Daily error digest: ${rows.length} problem(s)`, rows,
      'Technical errors that users did not see (they were shown a plain message instead). New or still happening since the last digest.');
    await database.query('UPDATE system_error_log SET emailed_at = NOW() WHERE emailed_at IS NULL OR last_seen > emailed_at');
  } catch (err: any) {
    logger.warn('Error digest failed', { error: err.message });
  }
}
