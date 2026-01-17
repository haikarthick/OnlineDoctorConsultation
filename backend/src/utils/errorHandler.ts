import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { AppError } from './errors';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  const path = req.path;
  const method = req.method;
  const requestId = req.headers['x-request-id'] || 'unknown';

  if (err instanceof AppError) {
    logger.warn('Application Error', {
      requestId,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      message: err.message,
      path,
      method,
      timestamp
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.errorCode,
        statusCode: err.statusCode,
        ...(process.env.NODE_ENV !== 'production' && { details: err.details }),
        timestamp,
        requestId
      }
    });
  }

  logger.error('Unhandled Error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path,
    method,
    timestamp
  });

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      timestamp,
      requestId
    }
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
