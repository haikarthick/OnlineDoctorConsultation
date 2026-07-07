import database from '../../utils/database';
import logger from '../../utils/logger';
import { PaymentGatewayMode } from './types';

/**
 * Cached reader for all payment-module system settings
 * (docs/PAYMENT_MODULE_PLAN.md §8 settings seeds).
 *
 * Every value is admin-configurable at runtime; a short TTL cache keeps the
 * hot paths (booking creation, checkout) from hitting system_settings on
 * every request while still picking up admin changes within a minute.
 */
const CACHE_TTL_MS = 60 * 1000;

interface CacheEntry {
  value: string | null;
  fetchedAt: number;
}

class PaymentModuleConfig {
  private cache = new Map<string, CacheEntry>();

  private async getRaw(key: string): Promise<string | null> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.value;
    try {
      const result = await database.query(`SELECT value FROM system_settings WHERE key = $1`, [key]);
      const value: string | null = result.rows[0]?.value ?? null;
      this.cache.set(key, { value, fetchedAt: Date.now() });
      return value;
    } catch (err: any) {
      logger.warn('PaymentModuleConfig read failed — using cached/default', { key, error: err.message });
      return hit?.value ?? null;
    }
  }

  /** Drop the cache (called after admin saves payment settings). */
  invalidate(): void {
    this.cache.clear();
  }

  async getString(key: string, defaultValue: string): Promise<string> {
    const v = await this.getRaw(key);
    return v === null || v === '' ? defaultValue : v;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const v = await this.getRaw(key);
    if (v === null || v === '') return defaultValue;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : defaultValue;
  }

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const v = await this.getRaw(key);
    if (v === null || v === '') return defaultValue;
    const normalized = v.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }

  // ── Typed accessors for the module's keys ──────────────────

  /** Master flag — when false the platform behaves exactly as before the module. */
  async isEnabled(): Promise<boolean> {
    return this.getBoolean('payment.enabled', false);
  }

  async getGatewayMode(): Promise<PaymentGatewayMode> {
    const raw = await this.getString('payment.gatewayMode', 'demo');
    const mode = raw.trim().toLowerCase();
    // 'test'/'live' are aliases from the legacy Payment Gateway admin card
    // (pre-dates this module, writes 'demo'/'test'/'live') — without this,
    // clicking TEST/LIVE there silently no-ops for the payment module.
    if (mode === 'razorpay_test' || mode === 'test') return 'razorpay_test';
    if (mode === 'razorpay_live' || mode === 'live') return 'razorpay_live';
    return 'demo';
  }

  async getCurrency(): Promise<string> {
    return this.getString('payment.currency', 'INR');
  }

  async getHoldMinutes(): Promise<number> {
    return this.getNumber('payment.holdMinutes', 15);
  }

  async getEmergencyHoldMinutes(): Promise<number> {
    return this.getNumber('payment.emergencyHoldMinutes', 5);
  }

  async getCommissionDefaultPercent(): Promise<number> {
    return this.getNumber('commission.defaultPercent', 15);
  }

  async getCommissionFlatFee(): Promise<number> {
    return this.getNumber('commission.flatFee', 20);
  }

  async getProcessingFlatFee(): Promise<number> {
    return this.getNumber('cancellation.processingFlatFee', 25);
  }

  async getClearanceDays(): Promise<number> {
    return this.getNumber('settlement.clearanceDays', 2);
  }

  async getMinWithdrawalAmount(): Promise<number> {
    return this.getNumber('settlement.minWithdrawalAmount', 500);
  }

  async getTdsRatePercent(): Promise<number> {
    return this.getNumber('settlement.tdsRatePercent', 0.1);
  }

  async getDoctorShareOfRetainedPercent(): Promise<number> {
    return this.getNumber('compensation.doctorShareOfRetainedPercent', 50);
  }

  async getDoctorShareOnPatientNoShowPercent(): Promise<number> {
    return this.getNumber('compensation.doctorShareOnPatientNoShowPercent', 100);
  }

  async getNegativeBalanceAlertAmount(): Promise<number> {
    return this.getNumber('compensation.negativeBalanceAlertAmount', 2000);
  }

  async getReferralActionWindowHours(): Promise<number> {
    return this.getNumber('referral.actionWindowHours', 72);
  }

  async getEmergencyConfirmMinutes(): Promise<number> {
    return this.getNumber('booking.emergencyConfirmMinutes', 10);
  }
}

export default new PaymentModuleConfig();
