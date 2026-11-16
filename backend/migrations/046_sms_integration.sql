-- Migration 046: SMS integration (owner decision 2026-11-16)
--
-- Many farm workers have no email, so SMS is the main channel for farm invitations and (later) due
-- reminders. India requires DLT registration (registered sender id + approved message templates)
-- before bulk SMS can be sent; until the owner has that, the module stays OFF and nothing is sent.
-- Once registered, the owner enters the provider details in Admin -> SMS Settings and it works -
-- no deploy needed.
--
--   * sms_* rows in system_settings hold the configuration (category 'sms'). Secrets (auth keys,
--     tokens) are write-only through the admin API: they are never sent back to the browser.
--   * sms_log keeps one row per send attempt (who, which template, outcome) for support and audit.
--     The phone number is stored masked; the message text is not stored.
--
-- Idempotent, and never hardcodes a schema name.

INSERT INTO system_settings (key, value, category, description) VALUES
  ('sms.enabled',                    'false',  'sms', 'Master switch for sending SMS. Off until DLT registration is done and a provider is configured.'),
  ('sms.provider',                   'msg91',  'sms', 'Which provider sends SMS: msg91, twilio, or log (writes to the server log only - for testing).'),
  ('sms.defaultCountryCode',         '91',     'sms', 'Country code added to a mobile number typed without one (91 = India).'),
  ('sms.msg91.authKey',              '',       'sms', 'MSG91 auth key (secret).'),
  ('sms.msg91.senderId',             '',       'sms', 'MSG91 / DLT registered sender id (6 letters), for reference and the admin test.'),
  ('sms.msg91.dltEntityId',          '',       'sms', 'DLT principal entity id (PE id), for reference.'),
  ('sms.twilio.accountSid',          '',       'sms', 'Twilio account SID.'),
  ('sms.twilio.authToken',           '',       'sms', 'Twilio auth token (secret).'),
  ('sms.twilio.from',                '',       'sms', 'Twilio sender number or sender id.'),
  ('sms.template.farm_invite.id',    '',       'sms', 'DLT-approved template / MSG91 flow id for the farm invitation SMS.'),
  ('sms.template.farm_invite.text',  '{inviter} invited you to join {farm} on WayToVet as {role}. Open: {link}', 'sms', 'Message text (Twilio) - must match the DLT-approved template. Variables: {inviter} {farm} {role} {link}.')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_masked VARCHAR(30) NOT NULL,
  template VARCHAR(60) NOT NULL,
  provider VARCHAR(20),
  status VARCHAR(12) NOT NULL,
  provider_message_id VARCHAR(120),
  error TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sms_log_status_ck CHECK (status IN ('sent', 'failed', 'skipped', 'logged'))
);
CREATE INDEX IF NOT EXISTS idx_sms_log_created ON sms_log(created_at DESC);
