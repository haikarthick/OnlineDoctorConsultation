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
  /** Prefix for the grooming GST invoice series (separate from consultation). */
  async getInvoicePrefix(): Promise<string> { return this.getString('grooming.invoicePrefix', 'GRM'); }
  /** SAC code for grooming/spa services (CA-confirmed at go-live). */
  async getSacCode(): Promise<string> { return this.getString('grooming.sacCode', '999721'); }

  // ── Provider acceptance gate ──────────────────────────────────
  // Money is collected first, then the order waits here for the provider to actively accept.
  // Grooming's own keys: the consultation gate has no timeout at all (unconfirmed bookings are
  // swept to 'missed' by a different job), so the two must stay independently tunable.
  /** How long a provider has to accept a paid booking before it auto-refunds. */
  async getAcceptanceWindowMinutes(): Promise<number> { return this.getNumber('grooming.acceptance.windowMinutes', 120); }
  /**
   * Skip the gate entirely and confirm on payment (the pre-036 behaviour). Escape hatch for
   * operators who would rather not risk auto-refunds; off by default because an unaccepted
   * booking is exactly the failure the gate exists to prevent.
   */
  async isAutoAcceptEnabled(): Promise<boolean> { return this.getBoolean('grooming.acceptance.autoAccept', false); }

  // ── Cancellation / refund policy ──────────────────────────────
  // Deliberately a separate 'grooming.*' namespace from the consultation 'cancellation.*' keys:
  // the two modules must be tunable without either affecting the other.
  /** Cancel at least this many hours out → full amount back, less the processing charge. */
  async getCancellationFreeWindowHours(): Promise<number> { return this.getNumber('grooming.cancellation.freeWindowHours', 24); }
  /** Inside the free window but at least this far out → partial refund percentage applies. */
  async getCancellationPartialWindowHours(): Promise<number> { return this.getNumber('grooming.cancellation.partialRefundWindowHours', 4); }
  async getCancellationPartialPercent(): Promise<number> { return this.getNumber('grooming.cancellation.partialRefundPercent', 50); }
  async getCancellationProcessingFlatFee(): Promise<number> { return this.getNumber('grooming.cancellation.processingFlatFee', 25); }
  /** Wallet bonus (% of amount paid) credited to the customer when the PROVIDER cancels. */
  async getGoodwillBonusPercent(): Promise<number> { return this.getNumber('grooming.cancellation.goodwillBonusPercent', 10); }
  /** Provider share (%) of money retained on a late customer cancellation. */
  async getProviderShareOfRetainedPercent(): Promise<number> { return this.getNumber('grooming.compensation.providerShareOfRetainedPercent', 50); }
  /** Provider share (%) of their net earning when the customer no-shows. */
  async getProviderShareOnNoShowPercent(): Promise<number> { return this.getNumber('grooming.compensation.providerShareOnNoShowPercent', 100); }
  /** Prefix for the grooming GST credit-note series issued on refunds (separate from GRM). */
  async getCreditNotePrefix(): Promise<string> { return this.getString('grooming.creditNotePrefix', 'GRMCN'); }
  /** TDS percentage withheld on grooming provider payouts (own key — not the consultation one). */
  async getTdsRatePercent(): Promise<number> { return this.getNumber('grooming.settlement.tdsRatePercent', 0); }
  /** Default refund destination: 'wallet' (instant) or 'gateway' (back to source). */
  async getDefaultRefundDestination(): Promise<'wallet' | 'gateway'> {
    const v = (await this.getString('grooming.refund.defaultDestination', 'wallet')).trim().toLowerCase();
    return v === 'gateway' ? 'gateway' : 'wallet';
  }
}

export default new GroomingModuleConfig();
