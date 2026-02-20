/**
 * CSRF Protection Middleware
 * ===========================
 * Implements the Double-Submit Cookie pattern:
 * 1. On GET /api/v1/csrf-token, server sets a signed cookie + returns a token.
 * 2. State-changing requests (POST/PUT/PATCH/DELETE) must include the
 *    token in X-CSRF-Token header (or _csrf body field).
 * 3. Middleware validates header value matches the cookie value.
 *
 * Safe methods (GET, HEAD, OPTIONS) are exempt.
 * API routes that only accept Bearer tokens from non-browser clients
 * can opt out via the `skipCsrf` route-level flag.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

const CSRF_COOKIE_NAME = '__csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_BODY_FIELD = '_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Generate a cryptographically random CSRF token */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF protection middleware.
 * Skips safe methods and requests that come with a valid Bearer token
 * (API-only clients that don't use cookies).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods don't need CSRF protection
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // If the request uses Bearer auth and does NOT send cookies,
  // it's from a programmatic client — skip CSRF check.
  const authHeader = req.headers.authorization;
  const hasCookies = req.headers.cookie && req.headers.cookie.includes(CSRF_COOKIE_NAME);
  if (authHeader && authHeader.startsWith('Bearer ') && !hasCookies) {
    return next();
  }

  // Validate: cookie token must match header/body token
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  const bodyToken = req.body?.[CSRF_BODY_FIELD] as string | undefined;
  const submittedToken = headerToken || bodyToken;

  if (!cookieToken || !submittedToken) {
    logger.warn('CSRF token missing', {
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    });
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }

  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(submittedToken))) {
    logger.warn('CSRF token mismatch', { path: req.path, method: req.method });
    res.status(403).json({ error: 'CSRF token invalid' });
    return;
  }

  next();
}

/**
 * Route handler: GET /api/v1/csrf-token
 * Issues a new CSRF token and sets the cookie.
 */
export function csrfTokenRoute(req: Request, res: Response): void {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,      // JS must read this cookie
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
  res.json({ csrfToken: token });
}
