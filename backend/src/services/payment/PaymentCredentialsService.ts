import database from '../../utils/database';
import logger from '../../utils/logger';
import { encryptSecret, decryptSecret } from '../../utils/secretCrypto';

export type GatewayEnvironment = 'test' | 'live';

interface CredentialRow {
  environment: GatewayEnvironment;
  keyId: string | null;
  keySecretEncrypted: string | null;
  webhookSecretEncrypted: string | null;
  updatedAt: string | null;
}

export interface MaskedCredentialStatus {
  environment: GatewayEnvironment;
  configured: boolean;
  keyId: string | null;
  keySecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  updatedAt: string | null;
}

const CACHE_TTL_MS = 60 * 1000;

/**
 * Razorpay credentials, stored encrypted in payment_gateway_credentials
 * (docs/PAYMENT_MODULE_PLAN.md §12 rule 6). Secrets are only ever decrypted
 * server-side for building the gateway's auth header — GET-style methods on
 * this service return masked metadata only, never plaintext secrets.
 */
class PaymentCredentialsService {
  private cache = new Map<GatewayEnvironment, { row: CredentialRow | null; fetchedAt: number }>();

  invalidate(): void {
    this.cache.clear();
  }

  private async getRow(environment: GatewayEnvironment): Promise<CredentialRow | null> {
    const hit = this.cache.get(environment);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.row;
    const result = await database.query(
      `SELECT environment, key_id as "keyId", key_secret_encrypted as "keySecretEncrypted",
        webhook_secret_encrypted as "webhookSecretEncrypted", updated_at as "updatedAt"
       FROM payment_gateway_credentials WHERE environment = $1`,
      [environment]
    );
    const row: CredentialRow | null = result.rows[0] || null;
    this.cache.set(environment, { row, fetchedAt: Date.now() });
    return row;
  }

  /** For the gateway adapter only — decrypted, never exposed via any API response. */
  async getForGateway(environment: GatewayEnvironment): Promise<{ keyId: string; keySecret: string; webhookSecret: string }> {
    const row = await this.getRow(environment);
    if (!row?.keyId || !row?.keySecretEncrypted) {
      throw new Error(
        `Razorpay ${environment} credentials are not configured. Set them in Admin → System Settings → Razorpay Credentials.`
      );
    }
    return {
      keyId: row.keyId,
      keySecret: decryptSecret(row.keySecretEncrypted),
      webhookSecret: row.webhookSecretEncrypted ? decryptSecret(row.webhookSecretEncrypted) : '',
    };
  }

  /** For webhook signature verification — only the webhook secret, decrypted. */
  async getWebhookSecret(environment: GatewayEnvironment): Promise<string> {
    const row = await this.getRow(environment);
    return row?.webhookSecretEncrypted ? decryptSecret(row.webhookSecretEncrypted) : '';
  }

  /** For the admin UI — masked, safe to return from a GET endpoint. */
  async getMaskedStatus(environment: GatewayEnvironment): Promise<MaskedCredentialStatus> {
    const row = await this.getRow(environment);
    return {
      environment,
      configured: !!(row?.keyId && row?.keySecretEncrypted),
      keyId: row?.keyId || null,
      keySecretConfigured: !!row?.keySecretEncrypted,
      webhookSecretConfigured: !!row?.webhookSecretEncrypted,
      updatedAt: row?.updatedAt || null,
    };
  }

  /**
   * Blank/omitted keySecret or webhookSecret means "keep the existing value"
   * — admins shouldn't have to re-paste a secret just to change the Key Id.
   */
  async setCredentials(
    environment: GatewayEnvironment,
    keyId: string,
    keySecret: string | undefined,
    webhookSecret: string | undefined,
    updatedBy: string
  ): Promise<void> {
    const keySecretEncrypted = keySecret ? encryptSecret(keySecret) : null;
    const webhookSecretEncrypted = webhookSecret ? encryptSecret(webhookSecret) : null;
    await database.query(
      `UPDATE payment_gateway_credentials
       SET key_id = $1,
           key_secret_encrypted = COALESCE($2, key_secret_encrypted),
           webhook_secret_encrypted = COALESCE($3, webhook_secret_encrypted),
           updated_by = $4, updated_at = NOW()
       WHERE environment = $5`,
      [keyId, keySecretEncrypted, webhookSecretEncrypted, updatedBy, environment]
    );
    this.invalidate();
    logger.info('Razorpay credentials updated', { environment, updatedBy, keySecretChanged: !!keySecret, webhookSecretChanged: !!webhookSecret });
  }
}

export default new PaymentCredentialsService();
