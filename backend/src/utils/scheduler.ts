/**
 * Scheduler
 *
 * Uses Node.js setInterval to run periodic background jobs.
 * No third-party cron library required.
 *
 * Jobs:
 *   - Hospital document expiry check: runs once at startup then every 24 hours
 *   - Missed bookings check: runs every 15 minutes to mark expired confirmed bookings
 *   - Network weekly digest: runs Monday 08:00 UTC for all active networks
 */

import HospitalDocumentService from '../services/HospitalDocumentService';
import BookingService from '../services/BookingService';
import NotificationService from '../services/NotificationService';
import MarketplaceService from '../services/MarketplaceService';
import database from './database';
import logger from './logger';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

export function startScheduler(): void {
  logger.info('Scheduler starting...');

  // Run once immediately on startup (catches overnight drift if server was down)
  runExpiryCheck();
  runMissedBookingsCheck();

  // Then every 24 hours
  setInterval(runExpiryCheck, TWENTY_FOUR_HOURS);

  // Check for missed bookings every 15 minutes
  setInterval(runMissedBookingsCheck, FIFTEEN_MINUTES);

  // Check every hour whether it's time to send weekly digests (Monday 08:00 UTC)
  scheduleWeeklyDigest();
  setInterval(scheduleWeeklyDigest, ONE_HOUR);

  // Marketplace maintenance jobs
  setInterval(runMarketplaceBoostExpiry, ONE_HOUR);
  setInterval(runMarketplaceListingExpiry, SIX_HOURS);
  setInterval(runMarketplaceAuctionClose, FIVE_MINUTES);

  // Payment module: expire unpaid slot holds (no-op while payment.enabled=false)
  setInterval(runPaymentHoldExpiry, FIVE_MINUTES);

  // Payment module: reconcile stuck 'pending' payments against the gateway (daily + on boot)
  runPaymentReconciliation();
  setInterval(runPaymentReconciliation, TWENTY_FOUR_HOURS);

  logger.info('Scheduler started — expiry check every 24h, missed bookings every 15min, weekly digest check every 1h, marketplace boost expiry every 1h, listing expiry every 6h, auction close every 5min, payment hold expiry every 5min');
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

async function runPaymentHoldExpiry(): Promise<void> {
  try {
    const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
    await PaymentOrchestrator.expireStalePaymentHolds();
  } catch (err: any) {
    logger.error('[Payments] Hold expiry job failed', { error: err.message });
  }
}

async function runPaymentReconciliation(): Promise<void> {
  try {
    const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
    await PaymentOrchestrator.reconcilePendingPayments();
  } catch (err: any) {
    logger.error('[Payments] Reconciliation job failed', { error: err.message });
  }
}

async function runMarketplaceBoostExpiry(): Promise<void> {
  try {
    const expired = await MarketplaceService.expireBoosts();
    if (expired > 0) logger.info(`[Marketplace] Expired ${expired} listing boost(s)`);
  } catch (err: any) {
    logger.error('[Marketplace] Boost expiry job failed', { error: err.message });
  }
}

async function runMarketplaceListingExpiry(): Promise<void> {
  try {
    const expired = await MarketplaceService.expireListings();
    if (expired > 0) logger.info(`[Marketplace] Expired ${expired} listing(s) past their end date`);
  } catch (err: any) {
    logger.error('[Marketplace] Listing expiry job failed', { error: err.message });
  }
}

async function runMarketplaceAuctionClose(): Promise<void> {
  try {
    const closed = await MarketplaceService.closeExpiredAuctions();
    if (closed > 0) logger.info(`[Marketplace] Closed ${closed} expired auction(s)`);
  } catch (err: any) {
    logger.error('[Marketplace] Auction close job failed', { error: err.message });
  }
}

/** Runs Monday 08:00 UTC — sends weekly digest to corporate_admin and hospital_director members */
async function scheduleWeeklyDigest(): Promise<void> {
  try {
    const now = new Date();
    // Day 1 = Monday in JS Date (0=Sunday)
    if (now.getUTCDay() !== 1 || now.getUTCHours() !== 8) return;

    logger.info('[WeeklyDigest] Monday 08:00 UTC — sending network digests');

    const networksRes = await database.query(
      `SELECT id FROM hospital_networks WHERE is_active = true AND is_approved = true`
    );

    for (const network of networksRes.rows) {
      try {
        const membersRes = await database.query(
          `SELECT user_id FROM hospital_network_members
           WHERE network_id = $1 AND network_role IN ('corporate_admin', 'hospital_director') AND is_active = true`,
          [network.id]
        );
        for (const member of membersRes.rows) {
          await NotificationService.sendNetworkDigest(network.id, member.user_id, 'weekly');
        }
      } catch (err: any) {
        logger.error('[WeeklyDigest] Failed for network', { networkId: network.id, error: err.message });
      }
    }

    logger.info('[WeeklyDigest] Completed');
  } catch (err: any) {
    logger.error('[WeeklyDigest] Unhandled error', { error: err.message });
  }
}
