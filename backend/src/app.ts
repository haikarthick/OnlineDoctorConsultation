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

// Rate limiting — generous limit for real-time polling (chat, session status)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

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
