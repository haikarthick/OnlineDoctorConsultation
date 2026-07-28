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
import MarketplaceEngagementService from '../services/MarketplaceEngagementService';
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
  runPharmacyStockAlerts();

  // Then every 24 hours
  setInterval(runExpiryCheck, TWENTY_FOUR_HOURS);
  setInterval(runPharmacyStockAlerts, TWENTY_FOUR_HOURS);

  // Check for missed bookings every 15 minutes
  setInterval(runMissedBookingsCheck, FIFTEEN_MINUTES);

  // Check every hour whether it's time to send weekly digests (Monday 08:00 UTC)
  scheduleWeeklyDigest();
  setInterval(scheduleWeeklyDigest, ONE_HOUR);

  // Marketplace maintenance jobs
  setInterval(runMarketplaceBoostExpiry, ONE_HOUR);
  setInterval(runMarketplaceListingExpiry, SIX_HOURS);
  setInterval(runMarketplaceAuctionClose, FIVE_MINUTES);
  setInterval(runMarketplaceReservationExpiry, ONE_HOUR);
  setInterval(runMarketplaceSavedSearchAlerts, ONE_HOUR);

  // Payment module: expire unpaid slot holds (no-op while payment.enabled=false)
  setInterval(runPaymentHoldExpiry, FIVE_MINUTES);

  // Grooming module: expire unpaid grooming slot holds (no-op while grooming.enabled=false)
  setInterval(runGroomingHoldExpiry, FIVE_MINUTES);

  // Grooming module: mature provider earnings clearing → available (hourly + on boot)
  runGroomingEarningsMaturity();
  setInterval(runGroomingEarningsMaturity, ONE_HOUR);

  // Payment module: reconcile stuck 'pending' payments against the gateway (daily + on boot)
  runPaymentReconciliation();
  setInterval(runPaymentReconciliation, TWENTY_FOUR_HOURS);

  // Payment module: mature doctor earnings clearing → available (hourly + on boot)
  runEarningsMaturity();
  setInterval(runEarningsMaturity, ONE_HOUR);

  // Payment module: expire un-actioned referral offers → auto refund (hourly)
  setInterval(runReferralExpiry, ONE_HOUR);

  // Payment module: emergency confirm-window fast-track (every minute; cheap no-op query)
  setInterval(runEmergencyFastTrack, 60 * 1000);

  logger.info('Scheduler started — expiry check every 24h, missed bookings every 15min, pharmacy stock alerts every 24h, weekly digest check every 1h, marketplace boost expiry every 1h, listing expiry every 6h, auction close every 5min, payment hold expiry every 5min, grooming hold expiry every 5min');
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

/**
 * Grooming's own hold expiry — separate job from the consultation one above on purpose: they
 * release different resources (grooming_orders vs bookings) under different settings, and one
 * module's schedule must never depend on the other's.
 */
async function runGroomingHoldExpiry(): Promise<void> {
  try {
    const GroomingPaymentService = (await import('../services/grooming/GroomingPaymentService')).default;
    await GroomingPaymentService.expireStaleHolds();
  } catch (err: any) {
    logger.error('[Grooming] Hold expiry job failed', { error: err.message });
  }
}

/** Grooming's own earnings maturity sweep (clearing → available), separate from the doctor one. */
async function runGroomingEarningsMaturity(): Promise<void> {
  try {
    const GroomingSettlementService = (await import('../services/grooming/GroomingSettlementService')).default;
    await GroomingSettlementService.releaseAllMatured();
  } catch (err: any) {
    logger.error('[Grooming] Earnings maturity job failed', { error: err.message });
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

async function runEarningsMaturity(): Promise<void> {
  try {
    const EarningsService = (await import('../services/payment/EarningsService')).default;
    await EarningsService.matureClearedEarnings();
  } catch (err: any) {
    logger.error('[Payments] Earnings maturity job failed', { error: err.message });
  }
}

async function runReferralExpiry(): Promise<void> {
  try {
    const ReferralService = (await import('../services/payment/ReferralService')).default;
    await ReferralService.expireStaleReferrals();
  } catch (err: any) {
    logger.error('[Payments] Referral expiry job failed', { error: err.message });
  }
}

async function runEmergencyFastTrack(): Promise<void> {
  try {
    const ReferralService = (await import('../services/payment/ReferralService')).default;
    await ReferralService.expireEmergencyConfirmations();
  } catch (err: any) {
    logger.error('[Payments] Emergency fast-track job failed', { error: err.message });
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

async function runMarketplaceReservationExpiry(): Promise<void> {
  try {
    const released = await MarketplaceService.expireReservations();
    if (released > 0) logger.info(`[Marketplace] Released ${released} expired reservation(s)`);
  } catch (err: any) {
    logger.error('[Marketplace] Reservation expiry job failed', { error: err.message });
  }
}

async function runMarketplaceSavedSearchAlerts(): Promise<void> {
  try {
    const sent = await MarketplaceEngagementService.runSavedSearchAlerts();
    if (sent > 0) logger.info(`[Marketplace] Sent ${sent} saved-search alert(s)`);
  } catch (err: any) {
    logger.error('[Marketplace] Saved-search alert job failed', { error: err.message });
  }
}

/** Daily digest to each network's pharmacists: low-stock items + batches expiring within 30 days. */
async function runPharmacyStockAlerts(): Promise<void> {
  try {
    const pharmaciesRes = await database.query(
      `SELECT hp.id AS pharmacy_id, hp.network_id, hp.pharmacy_name,
         COUNT(*) FILTER (WHERE pi.quantity <= pi.min_stock_level) AS low_stock_count,
         COUNT(*) FILTER (WHERE pi.expiry_date IS NOT NULL AND pi.expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND pi.expiry_date >= CURRENT_DATE) AS expiring_count
       FROM hospital_pharmacies hp
       JOIN pharmacy_inventory pi ON pi.pharmacy_id = hp.id
       WHERE hp.is_active = true
       GROUP BY hp.id, hp.network_id, hp.pharmacy_name
       HAVING COUNT(*) FILTER (WHERE pi.quantity <= pi.min_stock_level) > 0
           OR COUNT(*) FILTER (WHERE pi.expiry_date IS NOT NULL AND pi.expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND pi.expiry_date >= CURRENT_DATE) > 0`
    );
    let sent = 0;
    for (const pharmacy of pharmaciesRes.rows) {
      const pharmacistsRes = await database.query(
        `SELECT hnm.user_id FROM hospital_network_members hnm
         JOIN users u ON u.id = hnm.user_id
         WHERE hnm.network_id = $1 AND hnm.is_active = true AND u.role = 'pharmacist'`,
        [pharmacy.network_id]
      );
      const parts: string[] = [];
      if (Number(pharmacy.low_stock_count) > 0) parts.push(`${pharmacy.low_stock_count} item(s) low on stock`);
      if (Number(pharmacy.expiring_count) > 0) parts.push(`${pharmacy.expiring_count} batch(es) expiring within 30 days`);
      const message = `${pharmacy.pharmacy_name}: ${parts.join(', ')}.`;
      for (const p of pharmacistsRes.rows) {
        await NotificationService.createNotification(
          p.user_id, 'pharmacy_alert', 'Pharmacy Stock Alert', message, 'all',
          { pharmacyId: pharmacy.pharmacy_id, lowStockCount: Number(pharmacy.low_stock_count), expiringCount: Number(pharmacy.expiring_count) }
        );
        sent++;
      }
    }
    if (sent > 0) logger.info(`[Pharmacy] Sent ${sent} stock alert digest(s)`);
  } catch (err: any) {
    logger.error('[Pharmacy] Stock alert job failed', { error: err.message });
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
