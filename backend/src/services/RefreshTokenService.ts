/**
 * Refresh Token Service
 * =====================
 * Manages opaque refresh tokens stored in the database.
 * Supports token rotation — each refresh issues a new pair (access + refresh)
 * and revokes the old refresh token.
 */
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import database from '../utils/database';
import logger from '../utils/logger';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
}

class RefreshTokenService {

  /** Ensure the refresh_tokens table exists */
  async ensureTable(): Promise<void> {
    await database.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        replaced_by_token_id UUID,
        user_agent TEXT,
        ip_address VARCHAR(45)
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    `);
    logger.info('RefreshToken table ensured');
  }

  /** Hash the raw token for storage */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create a new refresh token for a user.
   * Returns the raw token (to give to the client) and the DB record ID.
   */
  async createToken(
    userId: string,
    expiresInMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ rawToken: string; tokenId: string }> {
    const rawToken = uuidv4() + '-' + crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const result = await database.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, tokenHash, expiresAt, meta?.userAgent || null, meta?.ipAddress || null]
    );

    return { rawToken, tokenId: result.rows[0].id };
  }

  /**
   * Validate a refresh token.
   * Returns the userId if valid, otherwise null.
   * Automatically revokes expired tokens.
   */
  async validateToken(rawToken: string): Promise<{ userId: string; tokenId: string } | null> {
    const tokenHash = this.hashToken(rawToken);

    const result = await database.query(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const record = result.rows[0];

    // Already revoked
    if (record.revoked_at) {
      logger.warn('Attempted reuse of revoked refresh token', {
        tokenId: record.id,
        userId: record.user_id,
      });
      // Revoke all tokens for this user (potential token theft)
      await this.revokeAllForUser(record.user_id);
      return null;
    }

    // Expired
    if (new Date(record.expires_at) < new Date()) {
      await this.revokeToken(record.id);
      return null;
    }

    return { userId: record.user_id, tokenId: record.id };
  }

  /** Revoke a specific token (mark as revoked, optionally link to replacement) */
  async revokeToken(tokenId: string, replacedByTokenId?: string): Promise<void> {
    await database.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_token_id = $2
       WHERE id = $1 AND revoked_at IS NULL`,
      [tokenId, replacedByTokenId || null]
    );
  }

  /** Revoke all refresh tokens for a user (logout from all devices) */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await database.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    return result.rowCount || 0;
  }

  /**
   * Rotate: validate old token → revoke it → issue new one.
   * Returns new access+refresh token pair, or null if invalid.
   */
  async rotateToken(
    oldRawToken: string,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ userId: string; newRawToken: string; newTokenId: string } | null> {
    const validation = await this.validateToken(oldRawToken);
    if (!validation) return null;

    const { userId, tokenId: oldTokenId } = validation;

    // Issue replacement
    const { rawToken: newRawToken, tokenId: newTokenId } = await this.createToken(userId, undefined, meta);

    // Revoke old, link to new
    await this.revokeToken(oldTokenId, newTokenId);

    return { userId, newRawToken, newTokenId };
  }

  /** Cleanup: delete tokens expired more than N days ago */
  async cleanupExpired(olderThanDays: number = 30): Promise<number> {
    const result = await database.query(
      `DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day' * $1`,
      [olderThanDays]
    );
    return result.rowCount || 0;
  }
}

export default new RefreshTokenService();
