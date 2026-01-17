import SecurityUtils from '../../src/utils/security';

describe('SecurityUtils', () => {
  describe('Password hashing and comparison', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123!';
      const hash = await SecurityUtils.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toEqual(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should compare password correctly', async () => {
      const password = 'testPassword123!';
      const hash = await SecurityUtils.hashPassword(password);

      const isMatch = await SecurityUtils.comparePassword(password, hash);
      expect(isMatch).toBe(true);
    });

    it('should not match incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword123!';
      const hash = await SecurityUtils.hashPassword(password);

      const isMatch = await SecurityUtils.comparePassword(wrongPassword, hash);
      expect(isMatch).toBe(false);
    });
  });

  describe('Token generation and verification', () => {
    it('should generate a valid token', () => {
      const payload = { userId: '123', email: 'test@example.com', role: 'user' };
      const token = SecurityUtils.generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should verify a valid token', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = SecurityUtils.generateToken(payload);

      const verified = SecurityUtils.verifyToken(token);
      expect(verified.userId).toEqual(payload.userId);
      expect(verified.email).toEqual(payload.email);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        SecurityUtils.verifyToken(invalidToken);
      }).toThrow();
    });

    it('should generate refresh token', () => {
      const token = SecurityUtils.generateRefreshToken('user123');

      expect(token).toBeDefined();
      const verified = SecurityUtils.verifyToken(token);
      expect(verified.userId).toEqual('user123');
    });
  });
});
