import database from '../../utils/database';
import logger from '../../utils/logger';

/**
 * Cached reader for the `nutrition.enabled` system setting (same pattern as FarmRecordsConfig). Default
 * false: the module is dark until an admin turns it on (docs/NUTRITION_PLAN.md).
 */
const CACHE_TTL_MS = 60 * 1000;
let cached: { value: boolean; at: number } | null = null;

export async function isNutritionEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  try {
    const r = await database.query(`SELECT value FROM system_settings WHERE key = 'nutrition.enabled'`);
    const v = String(r.rows[0]?.value ?? '').trim().toLowerCase();
    cached = { value: v === 'true' || v === '1', at: Date.now() };
    return cached.value;
  } catch (err: any) {
    logger.warn('nutrition.enabled read failed - using last known value', { error: err.message });
    return cached?.value ?? false;
  }
}

export function invalidateNutritionConfig(): void { cached = null; aiCached = null; }

/** `nutrition.ai_assist.enabled` (migration 062, default on): plain-language plan explanations through the AI provider. */
let aiCached: { value: boolean; at: number } | null = null;
export async function isAiAssistEnabled(): Promise<boolean> {
  if (aiCached && Date.now() - aiCached.at < CACHE_TTL_MS) return aiCached.value;
  try {
    const r = await database.query(`SELECT value FROM system_settings WHERE key = 'nutrition.ai_assist.enabled'`);
    const v = String(r.rows[0]?.value ?? '').trim().toLowerCase();
    aiCached = { value: v === 'true' || v === '1', at: Date.now() };
    return aiCached.value;
  } catch (err: any) {
    logger.warn('nutrition.ai_assist.enabled read failed - treating as off', { error: err.message });
    return aiCached?.value ?? false;
  }
}

/**
 * Entitlement seam (docs/NUTRITION_PLAN.md §5.6). Owner decision 2026-11-22: the module is free for everyone
 * at launch; paid plans come later, decided from real usage. Every endpoint asks this one function, so
 * introducing a plan later changes this function only - no screen or route is reworked.
 */
export type NutritionFeature = 'plans' | 'feeding_log' | 'measurements' | 'risk_flags' | 'ai_assist' | 'farm_ration';

export async function isEntitled(_userId: string, _feature: NutritionFeature): Promise<boolean> {
  return true;
}
