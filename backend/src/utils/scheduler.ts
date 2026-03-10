/**
 * Scheduler
 *
 * Uses Node.js setInterval to run periodic background jobs.
 * No third-party cron library required.
 *
 * Jobs:
 *   - Hospital document expiry check: runs once at startup then every 24 hours
 *   - Missed bookings check: runs every 15 minutes to mark expired confirmed bookings
 */

import HospitalDocumentService from '../services/HospitalDocumentService';
import BookingService from '../services/BookingService';
import logger from './logger';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function startScheduler(): void {
  logger.info('Scheduler starting...');

  // Run once immediately on startup (catches overnight drift if server was down)
  runExpiryCheck();
  runMissedBookingsCheck();

  // Then every 24 hours
  setInterval(runExpiryCheck, TWENTY_FOUR_HOURS);

  // Check for missed bookings every 15 minutes
  setInterval(runMissedBookingsCheck, FIFTEEN_MINUTES);

  logger.info('Scheduler started — hospital document expiry check runs every 24 hours, missed bookings check every 15 minutes');
}

async function runExpiryCheck(): Promise<void> {
  try {
    await HospitalDocumentService.runExpiryCheck();
  } catch (err: any) {
    logger.error('Scheduled expiry check threw an unhandled error', { error: err.message });
  }
}

async function runMissedBookingsCheck(): Promise<void> {
  try {
    const markedCount = await BookingService.markMissedBookings();
    if (markedCount > 0) {
      logger.info(`Marked ${markedCount} booking(s) as missed in scheduled check`);
    }
  } catch (err: any) {
    logger.error('Scheduled missed bookings check threw an unhandled error', { error: err.message });
  }
}
