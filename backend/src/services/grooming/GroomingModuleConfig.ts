import database from '../../utils/database';
import logger from '../../utils/logger';

/**
 * Cached reader for grooming-module system settings (mirrors PaymentModuleConfig).
 * Master flag `grooming.enabled` (default false) dark-launches the whole module.
 * See docs/PET_WELLNESS_GROOMING_SPA_PLAN.md.
 */
const CACHE_TTL_MS = 60 * 1000;

interface CacheEntry { value: string | null; fetchedAt: number; }

class GroomingModuleConfig {
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
      logger.warn('GroomingModuleConfig read failed — using cached/default', { key, error: err.message });
      return hit?.value ?? null;
    }
  }

  invalidate(): void { this.cache.clear(); }

  private async getBoolean(key: string, def: boolean): Promise<boolean> {
    const v = await this.getRaw(key);
    if (v === null || v === '') return def;
    const n = v.trim().toLowerCase();
    return n === 'true' || n === '1';
  }
  private async getNumber(key: string, def: number): Promise<number> {
    const v = await this.getRaw(key);
    if (v === null || v === '') return def;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : def;
  }
  private async getString(key: string, def: string): Promise<string> {
    const v = await this.getRaw(key);
    return v === null || v === '' ? def : v;
  }

  /** Master flag — false = module invisible/inert. */
  async isEnabled(): Promise<boolean> { return this.getBoolean('grooming.enabled', false); }

  async getCurrency(): Promise<string> { return this.getString('grooming.currency', 'INR'); }
  /** Platform commission % on each grooming payment (provider override wins). */
  async getCommissionDefaultPercent(): Promise<number> { return this.getNumber('grooming.commission.defaultPercent', 15); }
  async getCommissionFlatFee(): Promise<number> { return this.getNumber('grooming.commission.flatFee', 0); }
  /** Default GST % for grooming (taxable, unlike consultation). Admin-configurable; CA-confirmed. */
  async getTaxDefaultPercent(): Promise<number> { return this.getNumber('grooming.tax.defaultPercent', 18); }
  /** Days after completion before earnings move clearing → available (manual settlement). */
  async getClearanceDays(): Promise<number> { return this.getNumber('grooming.settlement.clearanceDays', 3); }
  /** Slot-hold minutes for pay-at-booking. */
  async getHoldMinutes(): Promise<number> { return this.getNumber('grooming.holdMinutes', 15); }
}

export default new GroomingModuleConfig();
