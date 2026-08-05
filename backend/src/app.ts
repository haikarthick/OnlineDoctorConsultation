import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import 'express-async-errors';

import config from './config';
import logger from './utils/logger';
import { errorHandler, asyncHandler } from './utils/errorHandler';
import { requestLogger, authMiddleware } from './middleware/auth';
import { csrfProtection, csrfTokenRoute } from './middleware/csrf';
import routes from './routes';
import database from './utils/database';
import cacheManager from './utils/cacheManager';

const app: Express = express();

// Trust reverse proxy (nginx / ALB / Cloudflare) - required for correct
// client IP in rate limiting, logging, and req.ip
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Razorpay checkout (payment module): script-src loads checkout.js,
      // frame-src is required for the hosted payment iframe (was 'none' -
      // blocked the whole widget even with a working script), connect-src
      // for the widget's own API/analytics calls.
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      // res.cloudinary.com: marketplace listing images/video (CloudinaryStorage
      // driver) - added 2026-07-21, without it every Cloudinary-hosted image
      // and video renders as a broken icon (uploads succeed, delivery is
      // silently CSP-blocked since it's a cross-origin img/video src).
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://unpkg.com", "https://*.razorpay.com", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://*.tile.openstreetmap.org", "wss:", "ws:", "https://api.groq.com", "https://*.razorpay.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "https://res.cloudinary.com"],
      frameSrc: ["https://*.razorpay.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors(config.cors));
app.use(cookieParser());

// ─── Rate Limiting (tiered) ──────────────────────────────────

/** Extract user identifier for per-user limiting (falls back to IP) */
function keyGenerator(req: express.Request): string {
  const authHeader = req.headers.authorization || ''
  if (authHeader.startsWith('Bearer ')) {
    try {
      // Verify the signature before trusting userId. An unverified payload can be
      // forged to evade one's own limit or to exhaust another user's budget (DoS).
      const payload = jwt.verify(authHeader.substring(7), config.jwt.secret as string, {
        algorithms: ['HS256'],
      }) as any
      if (payload.userId) return `user:${payload.userId}`
    } catch { /* invalid/expired token - fall through to IP */ }
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

// Strict: auth endpoints (login / register / refresh)
//
// Limits are env-overridable but the DEFAULTS ARE UNCHANGED (15 attempts / 15 min / IP), so
// production behaviour is exactly as before unless an operator opts in. The override exists
// because automated verification legitimately performs many auths from one IP: the runtime gate
// registers every role and logs in as every seeded demo account, and the e2e suite authenticates
// far more than that. Without this, those runs fail with 429s that look like app bugs and
// silently erode trust in the gate. Never set these on a customer-facing deployment.
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 15;
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
})

// Moderate: general API (per-user when authenticated)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
})

// Sensitive: admin & payment operations
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Rate limit reached for sensitive operations. Try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
})

// Uploads: /files/upload-image and /files/upload-video. These previously only inherited
// the general 300-req/15min apiLimiter - video uploads in particular are checked for
// duration only AFTER landing in Cloudinary (duration can't be read from raw bytes), so a
// user repeatedly uploading and getting rejected 100MB clips could burn through
// Cloudinary's hard-capped free tier (25 credits/month) well before hitting 300 requests.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many upload attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
})

// Apply limiters in order (most specific first)
app.use(`/api/${config.app.apiVersion}/auth/login`, authLimiter)
app.use(`/api/${config.app.apiVersion}/auth/register`, authLimiter)
app.use(`/api/${config.app.apiVersion}/auth/refresh`, authLimiter)
app.use(`/api/${config.app.apiVersion}/admin`, sensitiveLimiter)
app.use(`/api/${config.app.apiVersion}/payments`, sensitiveLimiter)
app.use(`/api/${config.app.apiVersion}/files/upload-image`, uploadLimiter)
app.use(`/api/${config.app.apiVersion}/files/upload-video`, uploadLimiter)
app.use('/api/', apiLimiter)

// Body parser
// Razorpay webhook needs the RAW body for signature verification - must be
// registered BEFORE express.json (body-parser skips already-parsed bodies)
app.use(`/api/${config.app.apiVersion}/webhooks/razorpay`, express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(requestLogger);

// Serve uploaded files statically.
// Harden against stored-XSS via spoofed-MIME uploads: `nosniff` stops the
// browser from re-interpreting a mislabelled file, and a locked-down CSP makes
// any HTML served from here inert (scripts can't run, resource is sandboxed).
// We intentionally do NOT force Content-Disposition: attachment - uploaded
// images/avatars are displayed inline in the SPA and must keep rendering.
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
  },
}));

// CSRF token endpoint (must be before csrfProtection middleware)
app.get(`/api/${config.app.apiVersion}/csrf-token`, csrfTokenRoute);

// CSRF protection for state-changing requests
// Auth endpoints (login/register/refresh/logout) are exempt because
// there is no authenticated session to hijack before login, and
// they already use rate-limiting + password validation for protection.
app.use(`/api/${config.app.apiVersion}`, (req, res, next) => {
  const authExemptPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/vet-hospitals/invites/accept'];
  if (authExemptPaths.some(p => req.path === p || req.path.endsWith(p))) {
    return next();
  }
  return csrfProtection(req, res, next);
});

// ─── Serve frontend static files when dist exists (Render deployments) ────
// Must come BEFORE the API welcome route so "/" serves the React app
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const hasFrontendDist = fs.existsSync(frontendDistPath);
if (hasFrontendDist) {
  app.use(express.static(frontendDistPath));
}

// API welcome route (only in development, or as /api fallback)
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'VetCare API',
    version: config.app.apiVersion,
    status: 'running',
    docs: `/api/${config.app.apiVersion}/health`,
    features: `/api/${config.app.apiVersion}/features`,
  });
});

// API Routes
app.use(`/api/${config.app.apiVersion}`, routes);

/**
 * A request for a build artefact - anything under /assets/, or any path ending in a static
 * file extension. These must NEVER fall through to the SPA's index.html.
 *
 * Why this matters: Vite fingerprints every chunk (App-a1b2c3.js). A deploy rebuilds them with
 * new hashes and the old files stop existing. A browser that still has the PREVIOUS index.html
 * open - anyone who had a tab open across the deploy - will request an old chunk name the next
 * time it navigates to a lazily-loaded route. The catch-all below used to answer that with
 * index.html and HTTP 200, so the browser received HTML where a JavaScript module was expected
 * and threw "Failed to fetch dynamically imported module", which surfaced as the generic
 * "Something went wrong" screen. A clean 404 lets the client detect the condition and recover.
 *
 * Extension-matched rather than "contains a dot", so SPA routes with dots in a path segment
 * still resolve to the app.
 */
const STATIC_ASSET_PATH = /(^\/assets\/)|\.(js|mjs|cjs|css|map|json|webmanifest|txt|xml|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf|eot|mp4|webm|wasm)$/i;

// 404 Handler - must come before error handler
app.use((req: Request, res: Response) => {
  // In production/Render, serve index.html for non-API routes (SPA client-side routing).
  // Asset requests are deliberately excluded - see STATIC_ASSET_PATH above.
  if (hasFrontendDist && !req.path.startsWith('/api/') && !STATIC_ASSET_PATH.test(req.path)) {
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      statusCode: 404,
      path: req.path
    }
  });
});

// Error handling - must be last middleware
app.use(errorHandler);

export default app;
