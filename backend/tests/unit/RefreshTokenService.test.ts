import RefreshTokenService from '../../src/services/RefreshTokenService';
import database from '../../src/utils/database';

jest.mock('../../src/utils/database');

describe('RefreshTokenService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureTable', () => {
    it('should create table without error', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(RefreshTokenService.ensureTable()).resolves.not.toThrow();
    });
  });

  describe('createToken', () => {
    it('should create a refresh token', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'token-1' }] });

      const result = await RefreshTokenService.createToken('user-1');
      expect(result).toBeDefined();
      expect(result.rawToken).toBeDefined();
      expect(result.tokenId).toBeDefined();
    });

    it('should create token with metadata', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'token-1' }] });

      const result = await RefreshTokenService.createToken('user-1', undefined, {
        userAgent: 'Chrome/120',
        ipAddress: '127.0.0.1',
      });

      expect(result.rawToken).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      // First create a token to get a valid hash
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'token-1' }] });
      const { rawToken } = await RefreshTokenService.createToken('user-1');

      // Now validate — need to mock the validation query
      (database.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 'token-1', user_id: 'user-1', is_revoked: false, expires_at: new Date(Date.now() + 86400000) }]
      });

      const result = await RefreshTokenService.validateToken(rawToken);
      expect(result).toBeDefined();
    });

    it('should return null for invalid token', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await RefreshTokenService.validateToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(RefreshTokenService.revokeToken('token-1')).resolves.not.toThrow();
    });

    it('should revoke with replacement token id', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(RefreshTokenService.revokeToken('token-1', 'token-2')).resolves.not.toThrow();
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all tokens for a user', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rowCount: 3 });

      const count = await RefreshTokenService.revokeAllForUser('user-1');
      expect(count).toBe(3);
    });
  });

  describe('rotateToken', () => {
    it('should return null for invalid old token', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await RefreshTokenService.rotateToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('should clean up expired tokens', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rowCount: 5 });

      const count = await RefreshTokenService.cleanupExpired();
      expect(count).toBe(5);
    });

    it('should clean up tokens older than specified days', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rowCount: 2 });

      const count = await RefreshTokenService.cleanupExpired(7);
      expect(count).toBe(2);
    });
  });
});
