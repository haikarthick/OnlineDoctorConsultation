import database from '../utils/database';
import logger from '../utils/logger';
import { getSmsSettings } from './sms/SmsConfig';
import { ADAPTERS } from './sms/providers';
import { maskPhone, normalizePhone } from './sms/phone';

/**
 * Sends a text message. Never throws for a delivery problem: the caller (a farm invitation, say)
 * must carry on and tell the person what happened, so every outcome comes back as a status.
 *
 *   sent     the provider accepted it
 *   logged   provider is "log": written to the server log only (testing)
 *   skipped  SMS is switched off, or the number is not usable - nothing was sent
 *   failed   the provider refused or could not be reached; `reason` says why in words
 */
export type SmsStatus = 'sent' | 'logged' | 'skipped' | 'failed';
export interface SmsOutcome { status: SmsStatus; reason?: string }

export interface SmsRequest {
  to: string;
  template: 'farm_invite' | string;
  vars: Record<string, string>;
  requestedBy?: string | null;
}

class SmsService {
  async send(req: SmsRequest): Promise<SmsOutcome> {
    const settings = await getSmsSettings();
    const to = normalizePhone(req.to, settings.defaultCountryCode);
    const masked = maskPhone(to || req.to);

    const record = async (status: SmsStatus, provider: string | null, messageId?: string, error?: string) => {
      try {
        await database.query(
          `INSERT INTO sms_log (to_masked, template, provider, status, provider_message_id, error, requested_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [masked, req.template, provider, status, messageId || null, error || null, req.requestedBy || null]
        );
      } catch (err: any) { logger.warn('Could not write sms_log', { error: err.message }); }
    };

    if (!to) {
      await record('skipped', null, undefined, 'The number is not a valid mobile number.');
      return { status: 'skipped', reason: 'That does not look like a valid mobile number.' };
    }
    if (!settings.enabled) {
      await record('skipped', settings.provider, undefined, 'SMS is switched off.');
      return { status: 'skipped', reason: 'SMS is not switched on yet, so no text message was sent.' };
    }

    const adapter = ADAPTERS[settings.provider];
    const result = await adapter.send({ to, template: req.template, vars: req.vars }, settings);
    if (!result.ok) {
      logger.warn('SMS send failed', { provider: settings.provider, template: req.template, to: masked, error: result.error });
      await record('failed', settings.provider, undefined, result.error);
      return { status: 'failed', reason: result.error || 'The text message could not be sent.' };
    }
    const status: SmsStatus = settings.provider === 'log' ? 'logged' : 'sent';
    if (status === 'logged') logger.info('SMS (log provider)', { to: masked, template: req.template, message: result.messageId });
    await record(status, settings.provider, result.messageId);
    return { status };
  }
}

export default new SmsService();
