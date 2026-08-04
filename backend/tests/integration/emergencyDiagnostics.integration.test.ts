import request from 'supertest';
import app from '../../src/app';

/**
 * Guards the break-glass gate on the two emergency diagnostic endpoints.
 *
 * Until 2026-08-03 both of these were registered with an explicit
 * "public - no auth required" comment and no gate of any kind, on a router
 * mounted unconditionally at /api/v1. That meant any anonymous caller could
 * read the entire schema layout (GET /debug/db-state) or replay all of
 * docker/init.sql as DDL and reseed the demo passwords (POST /repair-schema)
 * against production.
 *
 * These tests pin the two properties that matter:
 *   1. with EMERGENCY_DIAGNOSTIC_TOKEN unset, the endpoints do not exist;
 *   2. with it set, only the exact token gets through.
 *
 * The POST cases deliberately send `Authorization: Bearer x`. csrfProtection
 * skips any request with a Bearer prefix and no cookies (middleware/csrf.ts) and
 * does NOT validate that token itself, so this is the exact shape an anonymous
 * attacker would have used to reach the handler. Asserting on it proves the new
 * gate is what blocks the request, not CSRF incidentally standing in the way.
 */
describe('Integration - emergency diagnostics break-glass gate', () => {
  const ORIGINAL = process.env.EMERGENCY_DIAGNOSTIC_TOKEN;
  const TOKEN = 'test-emergency-token-0123456789';

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.EMERGENCY_DIAGNOSTIC_TOKEN;
    else process.env.EMERGENCY_DIAGNOSTIC_TOKEN = ORIGINAL;
  });

  describe('when EMERGENCY_DIAGNOSTIC_TOKEN is unset (fail closed)', () => {
    beforeEach(() => { delete process.env.EMERGENCY_DIAGNOSTIC_TOKEN; });

    it('GET /debug/db-state is a 404 for an anonymous caller', async () => {
      const res = await request(app).get('/api/v1/debug/db-state');
      expect(res.status).toBe(404);
      // must not leak schema details in the body
      expect(JSON.stringify(res.body)).not.toContain('searchPath');
    });

    it('POST /repair-schema is a 404 for an anonymous caller past CSRF', async () => {
      const res = await request(app)
        .post('/api/v1/repair-schema')
        .set('Authorization', 'Bearer x');
      expect(res.status).toBe(404);
    });

    it('does not accept an attacker-supplied token when none is configured', async () => {
      const res = await request(app)
        .post('/api/v1/repair-schema')
        .set('Authorization', 'Bearer x')
        .set('x-emergency-token', 'anything');
      expect(res.status).toBe(404);
    });
  });

  describe('when EMERGENCY_DIAGNOSTIC_TOKEN is set', () => {
    beforeEach(() => { process.env.EMERGENCY_DIAGNOSTIC_TOKEN = TOKEN; });

    it('still rejects a caller with no token', async () => {
      const res = await request(app).get('/api/v1/debug/db-state');
      expect(res.status).toBe(404);
    });

    it('rejects a wrong token of the same length', async () => {
      const res = await request(app)
        .get('/api/v1/debug/db-state')
        .set('x-emergency-token', 'X'.repeat(TOKEN.length));
      expect(res.status).toBe(404);
    });

    it('rejects a token that is a prefix of the real one', async () => {
      const res = await request(app)
        .get('/api/v1/debug/db-state')
        .set('x-emergency-token', TOKEN.slice(0, -1));
      expect(res.status).toBe(404);
    });

    it('lets the exact token through to the handler', async () => {
      const res = await request(app)
        .get('/api/v1/debug/db-state')
        .set('x-emergency-token', TOKEN);
      // 200 with a live DB, 500 without - either way it reached the handler,
      // which is what distinguishes it from the 404 the gate returns.
      expect(res.status).not.toBe(404);
    });
  });

  describe('a short token is treated as unset', () => {
    it('refuses to enable the gate on a weak token', async () => {
      process.env.EMERGENCY_DIAGNOSTIC_TOKEN = 'short';
      const res = await request(app)
        .get('/api/v1/debug/db-state')
        .set('x-emergency-token', 'short');
      expect(res.status).toBe(404);
    });
  });
});
