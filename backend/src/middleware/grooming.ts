import { Request, Response, NextFunction } from 'express';
import GroomingModuleConfig from '../services/grooming/GroomingModuleConfig';

/**
 * Gate for all grooming-module routes. When `grooming.enabled` is false the module is
 * dark - every grooming endpoint responds 404 (as if it doesn't exist), so nothing leaks
 * before launch. Mirrors the payment module's flag discipline.
 */
export async function groomingEnabled(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await GroomingModuleConfig.isEnabled()) return next();
  } catch { /* fall through to 404 */ }
  res.status(404).json({ success: false, message: 'Not found' });
}
