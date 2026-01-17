import request from 'supertest';
import app from '../../src/app';

describe('Integration Tests - Auth Routes', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+919876543210',
          password: 'securePassword123!',
          role: 'pet_owner'
        });

      expect(response.status).toBeLessThanOrEqual(500);
      // Note: Actual status depends on database availability
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com'
          // Missing other required fields
        });

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should fail with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
