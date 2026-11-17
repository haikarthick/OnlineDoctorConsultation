import database from '../../utils/database';

/**
 * SMS configuration lives in system_settings (category 'sms', keys 'sms.*') so the owner can enter
 * provider details in Admin -> SMS Settings once DLT registration is done - no deploy.
 *
 * Secrets are WRITE-ONLY through the admin API: `adminView()` reports only whether one is set.
 */
export const SECRET_KEYS = ['sms.msg91.authKey', 'sms.twilio.authToken'];
export const PROVIDERS = ['msg91', 'twilio', 'log'] as const;
export type SmsProvider = typeof PROVIDERS[number];

const CACHE_MS = 15 * 1000;
let cache: { at: number; values: Record<string, string> } | null = null;

export function invalidateSmsConfig(): void { cache = null; }

async function load(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.values;
  const r = await database.query(`SELECT key, value FROM system_settings WHERE key LIKE 'sms.%'`, []);
  const values: Record<string, string> = {};
  for (const row of r.rows) values[row.key] = row.value ?? '';
  cache = { at: Date.now(), values };
  return values;
}

export interface SmsSettings {
  enabled: boolean;
  provider: SmsProvider;
  defaultCountryCode: string;
  get: (key: string) => string;
}

export async function getSmsSettings(): Promise<SmsSettings> {
  const v = await load();
  const get = (k: string) => (v[k] ?? '').trim();
  const provider = (PROVIDERS as readonly string[]).includes(get('sms.provider')) ? get('sms.provider') as SmsProvider : 'msg91';
  return {
    enabled: ['true', '1'].includes(get('sms.enabled').toLowerCase()),
    provider,
    defaultCountryCode: get('sms.defaultCountryCode').replace(/\D/g, '') || '91',
    get,
  };
}

/** What the admin screen may see: every setting, with secrets replaced by "is it set". */
export async function adminView(): Promise<Array<{ key: string; value: string | null; isSecret: boolean; isSet: boolean; description: string | null }>> {
  const r = await database.query(`SELECT key, value, description FROM system_settings WHERE key LIKE 'sms.%' ORDER BY key`, []);
  return r.rows.map((row: any) => {
    const isSecret = SECRET_KEYS.includes(row.key);
    return {
      key: row.key,
      value: isSecret ? null : row.value,
      isSecret,
      isSet: !!(row.value && String(row.value).trim()),
      description: row.description || null,
    };
  });
}

/**
 * Applies an admin's changes. Only existing sms.* keys may be changed. A secret left blank / omitted
 * keeps its current value; sending `null` clears it.
 */
export async function applyAdminChanges(changes: Record<string, string | null>, updatedBy: string): Promise<string[]> {
  const known = await database.query(`SELECT key FROM system_settings WHERE key LIKE 'sms.%'`, []);
  const allowed = new Set<string>(known.rows.map((r: any) => r.key));
  const changed: string[] = [];
  for (const [key, raw] of Object.entries(changes)) {
    if (!allowed.has(key)) continue;
    const isSecret = SECRET_KEYS.includes(key);
    if (isSecret && (raw === '' || raw === undefined)) continue;
    const value = raw === null ? '' : String(raw).trim();
    await database.query(`UPDATE system_settings SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3`, [value, updatedBy, key]);
    changed.push(key);
  }
  invalidateSmsConfig();
  return changed;
}
