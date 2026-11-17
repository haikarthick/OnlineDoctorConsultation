import type { SmsSettings } from './SmsConfig';

/**
 * One adapter per SMS provider. An adapter only knows how to hand one message to one provider and
 * report what happened; whether to send at all, which template, masking and logging are SmsService's
 * job. Uses the platform's own fetch (Node 18+) - no extra dependency.
 */
export interface SendRequest {
  /** E.164, e.g. +919876543210 */
  to: string;
  template: string;
  /** Values for the template's variables (inviter, farm, role, link ...). */
  vars: Record<string, string>;
}
export interface SendResult { ok: boolean; messageId?: string; error?: string }
export interface SmsProviderAdapter { send(req: SendRequest, settings: SmsSettings): Promise<SendResult> }

const TIMEOUT_MS = 10000;

async function postWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(timer); }
}

/** {inviter} {farm} ... filled from vars; an unknown variable is left visible so a typo is noticed. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? vars[k] : all));
}

/** MSG91 Flow API: the DLT template is bound to a flow id; variables are passed by name. */
export const msg91: SmsProviderAdapter = {
  async send(req, settings) {
    const authKey = settings.get('sms.msg91.authKey');
    const flowId = settings.get(`sms.template.${req.template}.id`);
    if (!authKey) return { ok: false, error: 'MSG91 auth key is not set.' };
    if (!flowId) return { ok: false, error: `The DLT template id for "${req.template}" is not set.` };
    try {
      const res = await postWithTimeout('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ template_id: flowId, short_url: '0', recipients: [{ mobiles: req.to.replace('+', ''), ...req.vars }] }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.type === 'error') return { ok: false, error: String(data?.message || `MSG91 refused the message (HTTP ${res.status}).`) };
      return { ok: true, messageId: data?.message ? String(data.message) : undefined };
    } catch (err: any) {
      return { ok: false, error: err?.name === 'AbortError' ? 'MSG91 did not answer in time.' : `Could not reach MSG91: ${err?.message || 'network error'}` };
    }
  },
};

/** Twilio Messages API: the text is ours (it must match the DLT-approved template for India). */
export const twilio: SmsProviderAdapter = {
  async send(req, settings) {
    const sid = settings.get('sms.twilio.accountSid');
    const token = settings.get('sms.twilio.authToken');
    const from = settings.get('sms.twilio.from');
    const text = settings.get(`sms.template.${req.template}.text`);
    if (!sid || !token) return { ok: false, error: 'Twilio account SID or auth token is not set.' };
    if (!from) return { ok: false, error: 'The Twilio sender is not set.' };
    if (!text) return { ok: false, error: `The message text for "${req.template}" is not set.` };
    try {
      const res = await postWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: 'POST',
        headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: req.to, From: from, Body: renderTemplate(text, req.vars) }).toString(),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: String(data?.message || `Twilio refused the message (HTTP ${res.status}).`) };
      return { ok: true, messageId: data?.sid };
    } catch (err: any) {
      return { ok: false, error: err?.name === 'AbortError' ? 'Twilio did not answer in time.' : `Could not reach Twilio: ${err?.message || 'network error'}` };
    }
  },
};

/** Testing: nothing leaves the server; the rendered text goes to the server log. */
export const logOnly: SmsProviderAdapter = {
  async send(req, settings) {
    const text = renderTemplate(settings.get(`sms.template.${req.template}.text`) || `[${req.template}] ${JSON.stringify(req.vars)}`, req.vars);
    return { ok: true, messageId: `log:${text.slice(0, 60)}` };
  },
};

export const ADAPTERS: Record<string, SmsProviderAdapter> = { msg91, twilio, log: logOnly };
