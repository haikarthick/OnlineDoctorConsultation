import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
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

// Trust reverse proxy (nginx / ALB / Cloudflare) – required for correct
// client IP in rate limiting, logging, and req.ip
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
      connectSrc: ["'self'", "https://*.tile.openstreetmap.org", "wss:", "ws:", "https://api.groq.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
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
      // Decode JWT payload without verifying (rate limiter runs before auth)
      const payload = JSON.parse(Buffer.from(authHeader.split('.')[1], 'base64').toString())
      if (payload.userId) return `user:${payload.userId}`
    } catch { /* fall through to IP */ }
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

// Strict: auth endpoints (login / register / refresh)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
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

// Apply limiters in order (most specific first)
app.use(`/api/${config.app.apiVersion}/auth/login`, authLimiter)
app.use(`/api/${config.app.apiVersion}/auth/register`, authLimiter)
app.use(`/api/${config.app.apiVersion}/auth/refresh`, authLimiter)
app.use(`/api/${config.app.apiVersion}/admin`, sensitiveLimiter)
app.use(`/api/${config.app.apiVersion}/payments`, sensitiveLimiter)
app.use('/api/', apiLimiter)

// Body parser
// Razorpay webhook needs the RAW body for signature verification — must be
// registered BEFORE express.json (body-parser skips already-parsed bodies)
app.use(`/api/${config.app.apiVersion}/webhooks/razorpay`, express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(requestLogger);

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'))));

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

// 404 Handler - must come before error handler
app.use((req: Request, res: Response) => {
  // In production/Render, serve index.html for non-API routes (SPA client-side routing)
  if (hasFrontendDist && !req.path.startsWith('/api/')) {
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
