/**
 * Scheduler
 *
 * Uses Node.js setInterval to run periodic background jobs.
 * No third-party cron library required.
 *
 * Jobs:
 *   - Hospital document expiry check: runs once at startup then every 24 hours
 */

import HospitalDocumentService from '../services/HospitalDocumentService';
import logger from './logger';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function startScheduler(): void {
  logger.info('Scheduler starting...');

  // Run once immediately on startup (catches overnight drift if server was down)
  runExpiryCheck();

  // Then every 24 hours
  setInterval(runExpiryCheck, TWENTY_FOUR_HOURS);

  logger.info('Scheduler started — hospital document expiry check runs every 24 hours');
}

async function runExpiryCheck(): Promise<void> {
  try {
    await HospitalDocumentService.runExpiryCheck();
  } catch (err: any) {
    logger.error('Scheduled expiry check threw an unhandled error', { error: err.message });
  }
}
