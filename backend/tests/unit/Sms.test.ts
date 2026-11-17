import database from '../../src/utils/database';
import SmsService from '../../src/services/SmsService';
import { normalizePhone, maskPhone, looksLikePhone } from '../../src/services/sms/phone';
import { msg91, twilio, renderTemplate } from '../../src/services/sms/providers';
import { getSmsSettings, adminView, applyAdminChanges, invalidateSmsConfig, SECRET_KEYS } from '../../src/services/sms/SmsConfig';

jest.mock('../../src/utils/database');
const query = database.query as jest.Mock;

describe('normalizePhone', () => {
  it('writes every way people type an Indian mobile number the same way', () => {
    for (const v of ['9876543210', '98765 43210', '+91 98765 43210', '+91-98765-43210', '09876543210', '919876543210', '0091 9876543210', '(98765) 43210']) {
      expect(normalizePhone(v)).toBe('+919876543210');
    }
  });
  it('refuses what cannot be a mobile number', () => {
    for (const v of ['', '   ', 'abc', '12345', '5876543210', '98765', '+91 12345 67890', '98765432101234567', null, undefined, 123]) {
      expect(normalizePhone(v as any)).toBeNull();
    }
  });
  it('keeps a foreign number that was typed with its country code', () => {
    expect(normalizePhone('+44 7911 123456')).toBe('+447911123456');
  });
  it('uses the configured country code', () => {
    expect(normalizePhone('7911123456', '44')).toBe('+447911123456');
  });
  it('masks for logs and screens', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98••••3210');
    expect(maskPhone('')).toBe('');
    expect(maskPhone('+9198')).toBe('••••');
  });
  it('tells a phone from an email for the "email or mobile" login field', () => {
    expect(looksLikePhone('98765 43210')).toBe(true);
    expect(looksLikePhone('+91 98765 43210')).toBe(true);
    expect(looksLikePhone('tom@farm.com')).toBe(false);
    expect(looksLikePhone('tom')).toBe(false);
  });
});

describe('templates', () => {
  it('fills the variables and leaves an unknown one visible', () => {
    expect(renderTemplate('{inviter} invited you to {farm}. {typo}', { inviter: 'Ravi', farm: 'Green Pastures' })).toBe('Ravi invited you to Green Pastures. {typo}');
  });
});

function settings(values: Record<string, string>) {
  invalidateSmsConfig();
  query.mockImplementation(async (sql: string) => {
    if (/FROM system_settings WHERE key LIKE/.test(sql) && /SELECT key, value FROM/.test(sql)) return { rows: Object.entries(values).map(([key, value]) => ({ key, value })) };
    return { rows: [] };
  });
}

describe('SmsService', () => {
  const fetchMock = jest.fn();
  beforeEach(() => { jest.resetAllMocks(); (global as any).fetch = fetchMock; invalidateSmsConfig(); });
  const req = { to: '98765 43210', template: 'farm_invite', vars: { inviter: 'Ravi', farm: 'Green Pastures', role: 'worker', link: 'https://x/y' } };

  it('sends nothing while SMS is switched off, and says so in words', async () => {
    settings({ 'sms.enabled': 'false', 'sms.provider': 'msg91' });
    const r = await SmsService.send(req);
    expect(r).toMatchObject({ status: 'skipped' });
    expect(r.reason).toMatch(/not switched on/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a number that cannot be a mobile, without calling the provider', async () => {
    settings({ 'sms.enabled': 'true', 'sms.provider': 'msg91' });
    const r = await SmsService.send({ ...req, to: '12345' });
    expect(r).toMatchObject({ status: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('MSG91: posts the flow with the number in international form and the variables by name', async () => {
    settings({ 'sms.enabled': 'true', 'sms.provider': 'msg91', 'sms.msg91.authKey': 'KEY', 'sms.template.farm_invite.id': 'FLOW1' });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ type: 'success', message: 'req123' }) });
    const r = await SmsService.send(req);
    expect(r).toEqual({ status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://control.msg91.com/api/v5/flow/');
    expect(init.headers.authkey).toBe('KEY');
    expect(JSON.parse(init.body)).toEqual({ template_id: 'FLOW1', short_url: '0', recipients: [{ mobiles: '919876543210', inviter: 'Ravi', farm: 'Green Pastures', role: 'worker', link: 'https://x/y' }] });
  });

  it('MSG91: missing credentials are explained, not thrown', async () => {
    settings({ 'sms.enabled': 'true', 'sms.provider': 'msg91' });
    const r = await SmsService.send(req);
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/auth key is not set/);
    settings({ 'sms.enabled': 'true', 'sms.provider': 'msg91', 'sms.msg91.authKey': 'K' });
    expect((await SmsService.send(req)).reason).toMatch(/DLT template id/);
  });

  it('a provider refusal comes back as a plain reason and is logged', async () => {
    settings({ 'sms.enabled': 'true', 'sms.provider': 'msg91', 'sms.msg91.authKey': 'K', 'sms.template.farm_invite.id': 'F' });
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ type: 'error', message: 'Template not approved' }) });
    const r = await SmsService.send(req);
    expect(r).toEqual({ status: 'failed', reason: 'Template not approved' });
    const logCall = query.mock.calls.find(c => /INSERT INTO sms_log/.test(c[0]))!;
    expect(logCall[1][0]).toBe('+91 98••••3210'); // masked in the log
    expect(logCall[1][3]).toBe('failed');
  });

  it('an unreachable provider is a plain reason too', async () => {
    settings({ 'sms.enabled': 'true', 'sms.provider': 'twilio', 'sms.twilio.accountSid': 'AC1', 'sms.twilio.authToken': 'T', 'sms.twilio.from': '+1555', 'sms.template.farm_invite.text': '{inviter} / {farm}' });
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const r = await SmsService.send(req);
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/Could not reach Twilio/);
  });

  it('Twilio: basic auth, our own text with the variables filled', async () => {
    settings({ 'sms.enabled': 'true', 'sms.provider': 'twilio', 'sms.twilio.accountSid': 'AC1', 'sms.twilio.authToken': 'T', 'sms.twilio.from': '+15550001', 'sms.template.farm_invite.text': '{inviter} invited you to {farm}: {link}' });
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ sid: 'SM1' }) });
    expect(await SmsService.send(req)).toEqual({ status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from('AC1:T').toString('base64')}`);
    const body = new URLSearchParams(init.body);
    expect(body.get('To')).toBe('+919876543210');
    expect(body.get('Body')).toBe('Ravi invited you to Green Pastures: https://x/y');
  });

  it('the log provider sends nothing out', async () => {
    settings({ 'sms.enabled': 'true', 'sms.provider': 'log', 'sms.template.farm_invite.text': '{farm}' });
    expect(await SmsService.send(req)).toEqual({ status: 'logged' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SMS settings for the admin', () => {
  beforeEach(() => { jest.resetAllMocks(); invalidateSmsConfig(); });

  it('reads defaults safely when nothing is configured', async () => {
    settings({});
    const s = await getSmsSettings();
    expect(s).toMatchObject({ enabled: false, provider: 'msg91', defaultCountryCode: '91' });
  });

  it('never sends a secret back: only whether it is set', async () => {
    query.mockResolvedValue({ rows: [
      { key: 'sms.msg91.authKey', value: 'SUPERSECRET', description: 'k' },
      { key: 'sms.msg91.senderId', value: 'WAYVET', description: 's' },
    ] });
    const v = await adminView();
    expect(JSON.stringify(v)).not.toContain('SUPERSECRET');
    expect(v.find(x => x.key === 'sms.msg91.authKey')).toMatchObject({ value: null, isSecret: true, isSet: true });
    expect(v.find(x => x.key === 'sms.msg91.senderId')).toMatchObject({ value: 'WAYVET', isSecret: false });
  });

  it('a blank secret keeps the current one; null clears it; unknown keys are ignored', async () => {
    query.mockImplementation(async (sql: string) => {
      if (/SELECT key FROM system_settings/.test(sql)) return { rows: SECRET_KEYS.concat(['sms.enabled']).map(key => ({ key })) };
      return { rows: [] };
    });
    const changed = await applyAdminChanges({ 'sms.msg91.authKey': '', 'sms.twilio.authToken': null, 'sms.enabled': 'true', 'sms.evil': 'x' }, 'admin1');
    expect(changed.sort()).toEqual(['sms.enabled', 'sms.twilio.authToken']);
    const updates = query.mock.calls.filter(c => /UPDATE system_settings/.test(c[0]));
    expect(updates).toHaveLength(2);
    expect(updates.find(c => c[1][2] === 'sms.twilio.authToken')![1][0]).toBe('');
  });
});
