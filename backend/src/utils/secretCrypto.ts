import crypto from 'crypto';

/**
 * AES-256-GCM encryption for secrets stored at rest in the DB (payment
 * gateway credentials — docs/PAYMENT_MODULE_PLAN.md §12 rule 6 requires
 * secrets never be readable in plaintext from any admin API response;
 * this is what makes DB storage safe to allow instead of env-vars-only).
 *
 * The master key comes from PAYMENT_CREDENTIALS_KEY (env var, set once per
 * deploy target) — never stored in the DB itself. Any string length is
 * accepted and normalized to 32 bytes via SHA-256 so ops doesn't have to
 * generate a key in a specific format.
 */

function getMasterKey(): Buffer {
  const raw = process.env.PAYMENT_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error('PAYMENT_CREDENTIALS_KEY env var is not set — cannot encrypt/decrypt stored gateway credentials.');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/** Returns base64(iv[12] + authTag[16] + ciphertext) — a single opaque string for one TEXT column. */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(stored: string): string {
  const key = getMasterKey();
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
