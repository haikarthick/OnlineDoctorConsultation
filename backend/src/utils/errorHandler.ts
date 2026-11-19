import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { AppError } from './errors';
import { recordSystemError } from '../services/ErrorAlertService';

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
      message: err.message,
      error: {
        message: err.message,
        code: err.errorCode,
        statusCode: err.statusCode,
        ...(process.env.NODE_ENV === 'development' && { details: err.details }),
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

  void recordSystemError({ reference: String(requestId).slice(0, 16), status: 500, method, path: req.originalUrl, message: err.message });
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
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
