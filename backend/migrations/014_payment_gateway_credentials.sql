-- Payment gateway credentials (Razorpay), stored encrypted at rest.
-- docs/PAYMENT_MODULE_PLAN.md §12 rule 6: secrets never readable in
-- plaintext via any admin API response. key_id is not sensitive (Razorpay
-- sends it to the browser in the checkout widget anyway) so it's stored
-- plain; key_secret and webhook_secret are AES-256-GCM encrypted by the
-- application (backend/src/utils/secretCrypto.ts) before insert.

CREATE TABLE IF NOT EXISTS payment_gateway_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(10) NOT NULL UNIQUE CHECK (environment IN ('test', 'live')),
  key_id VARCHAR(255),
  key_secret_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payment_gateway_credentials (id, environment) VALUES
  (gen_random_uuid(), 'test'),
  (gen_random_uuid(), 'live')
ON CONFLICT (environment) DO NOTHING;

DROP TRIGGER IF EXISTS update_payment_gateway_credentials_updated_at ON payment_gateway_credentials;
CREATE TRIGGER update_payment_gateway_credentials_updated_at BEFORE UPDATE ON payment_gateway_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
