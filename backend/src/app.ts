import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
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

// Security Middleware
app.use(helmet());
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(requestLogger);

// CSRF token endpoint (must be before csrfProtection middleware)
app.get(`/api/${config.app.apiVersion}/csrf-token`, csrfTokenRoute);

// CSRF protection for state-changing requests
app.use(`/api/${config.app.apiVersion}`, csrfProtection);

// Root welcome route (so localhost:3000 doesn't show 404)
app.get('/', (_req: Request, res: Response) => {
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
