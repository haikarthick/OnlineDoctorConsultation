import database from '../../utils/database';
import logger from '../../utils/logger';

/**
 * Cached reader for the `farm.records.enabled` system setting (same pattern as
 * GroomingModuleConfig / PaymentModuleConfig). Default false: the module is dark until an admin
 * turns it on. See docs/FARM_MANAGEMENT_PLAN.md Phase 4.
 */
const CACHE_TTL_MS = 60 * 1000;
let cached: { value: boolean; at: number } | null = null;

export async function isFarmRecordsEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  try {
    const r = await database.query(`SELECT value FROM system_settings WHERE key = 'farm.records.enabled'`);
    const v = String(r.rows[0]?.value ?? '').trim().toLowerCase();
    cached = { value: v === 'true' || v === '1', at: Date.now() };
    return cached.value;
  } catch (err: any) {
    logger.warn('farm.records.enabled read failed - using last known value', { error: err.message });
    return cached?.value ?? false;
  }
}

export function invalidateFarmRecordsConfig(): void { cached = null; }
