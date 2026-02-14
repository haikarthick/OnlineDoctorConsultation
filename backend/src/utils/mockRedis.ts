/**
 * Mock Redis Cache for Development
 * Simulates Redis cache without needing actual Redis server
 */

import logger from './logger';

class MockRedis {
  private cache: Map<string, { value: any; expiresAt?: number }> = new Map();
  private connected: boolean = false;

  constructor() {}

  async connect(): Promise<void> {
    try {
      this.connected = true;
      logger.info('Mock Redis cache connected successfully');
    } catch (error) {
      logger.error('Failed to connect to mock Redis', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.cache.clear();
      this.connected = false;
      logger.info('Mock Redis cache disconnected');
    } catch (error) {
      logger.error('Error disconnecting from mock Redis', { error });
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const entry = this.cache.get(key);
      if (!entry) return null;

      // Check expiration
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        return null;
      }

      // Return stringified value
      return typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
    } catch (error) {
      logger.error('Cache get operation failed', { error, key });
      throw error;
    }
  }

  async set(key: string, value: any, exSeconds?: number): Promise<void> {
    try {
      const expiresAt = exSeconds ? Date.now() + exSeconds * 1000 : undefined;
      this.cache.set(key, { value, expiresAt });
    } catch (error) {
      logger.error('Cache set operation failed', { error, key });
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      const existed = this.cache.has(key);
      this.cache.delete(key);
      return existed ? 1 : 0;
    } catch (error) {
      logger.error('Cache delete operation failed', { error, key });
      throw error;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      const entry = this.cache.get(key);
      if (!entry) return 0;

      // Check expiration
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        return 0;
      }

      return 1;
    } catch (error) {
      logger.error('Cache exists check failed', { error, key });
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      const entry = this.cache.get(key);
      if (!entry) return 0;

      entry.expiresAt = Date.now() + seconds * 1000;
      this.cache.set(key, entry);
      return 1;
    } catch (error) {
      logger.error('Cache expire operation failed', { error, key });
      throw error;
    }
  }

  async flushAll(): Promise<void> {
    try {
      this.cache.clear();
    } catch (error) {
      logger.error('Cache flush operation failed', { error });
      throw error;
    }
  }

  // Additional helper methods
  async ping(): Promise<string> {
    return 'PONG';
  }
}

export default new MockRedis();
