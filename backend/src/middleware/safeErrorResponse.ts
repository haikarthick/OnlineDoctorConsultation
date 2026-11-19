/**
 * Safety net: no API response may ever carry technical text to a person.
 *
 * Owner rule (CLAUDE.md "users never see error codes"): a user must never read a database error,
 * a stack frame or a library message. ~220 controllers still answer with
 * `res.status(500).json({ error: { message: err.message } })`, so instead of trusting each one,
 * every JSON response passes through here. If `error.message` looks technical it is replaced with
 * a plain what-happened / what-next sentence, the original is logged with a reference id, and the
 * reference id is returned so support can find it. Readable messages pass through unchanged.
 */
import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

const TECHNICAL_PATTERNS: RegExp[] = [
  /column ".*" (of relation|does not exist)/i,
  /relation ".*" (does not exist|already exists)/i,
  /(table|schema|function|type|constraint|index) ".*" (does not exist|already exists)/i,
  /violates (foreign key|unique|check|not-null) constraint/i,
  /duplicate key value/i,
  /null value in column/i,
  /syntax error (at or near|in)/i,
  /invalid input (syntax|value) for/i,
  /value too long for type/i,
  /permission denied for/i,
  /could not (serialize|connect|translate)/i,
  /deadlock detected/i,
  /terminating connection|connection terminated|Connection refused|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND/i,
  /cannot read propert(y|ies) of|is not a function|is not defined|is not iterable|undefined is not/i,
  /Unexpected token|JSON at position|in JSON/i,
  /Request failed with status code/i,
  /\bat [\w.<>$ ]+ \(.*:\d+:\d+\)/,
  /\b(SequelizeDatabaseError|QueryFailedError|PrismaClient|ERR_[A-Z_]{4,})\b/,
  /\bpg_|\bSQLSTATE\b/i,
  /^\s*(Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\s*$/i,
];

export function isTechnicalMessage(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  return TECHNICAL_PATTERNS.some(re => re.test(message));
}

/** Plain-language replacement, chosen by status class. English; the client shows its own
 *  translated fallback when it has one, this only guarantees nothing technical leaks. */
export function plainMessageFor(status: number): string {
  if (status === 401) return 'Your session has ended. Please sign in again to continue.';
  if (status === 403) return 'You do not have permission to do this. Ask the owner or an admin to give you access.';
  if (status === 404) return 'We could not find what you asked for. It may have been removed - go back and try again.';
  if (status === 409) return 'This clashes with something that already exists. Check the details and try again.';
  if (status >= 400 && status < 500) return 'Something in this request is not right. Please check what you entered and try again.';
  return 'Something went wrong on our side and your change was not saved. Please try again in a moment - if it keeps happening, tell support the reference shown.';
}

export function safeErrorResponse(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = (body?: any) => {
    try {
      const err = body && typeof body === 'object' ? body.error : undefined;
      const msg = err && typeof err === 'object' ? err.message : typeof err === 'string' ? err : undefined;
      if (res.statusCode >= 400 && isTechnicalMessage(msg)) {
        const reference = crypto.randomBytes(4).toString('hex');
        logger.error('Technical error hidden from client', {
          reference, status: res.statusCode, method: req.method, path: req.originalUrl, original: msg,
        });
        const safe = plainMessageFor(res.statusCode);
        const next5xx = res.statusCode >= 500 ? { reference } : {};
        const replaced = typeof err === 'object'
          ? { ...body, error: { ...err, message: safe, ...next5xx } }
          : { ...body, error: { message: safe, ...next5xx } };
        // `message` at top level (some controllers use it) must not leak either
        if (typeof replaced.message === 'string' && isTechnicalMessage(replaced.message)) replaced.message = safe;
        return originalJson(replaced);
      }
      if (res.statusCode >= 400 && body && typeof body.message === 'string' && isTechnicalMessage(body.message)) {
        return originalJson({ ...body, message: plainMessageFor(res.statusCode) });
      }
    } catch { /* never let the net itself break a response */ }
    return originalJson(body);
  };
  next();
}
