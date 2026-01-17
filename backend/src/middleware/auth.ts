import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { UnauthorizedError } from '../utils/errors';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  token?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token', { error: error.message });
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(new UnauthorizedError('Authentication failed'));
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.get('x-request-id') || `${Date.now()}-${Math.random()}`;

  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

export const validateBody = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = schema.validate(req.body, { abortEarly: false });
      if (error) {
        const messages = error.details.map(d => d.message).join(', ');
        return res.status(400).json({ error: messages });
      }
      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};
