import config from '../config';
import logger from './logger';

// Use mock Redis for development if MOCK_REDIS is enabled or in development mode
let CacheManager: any;

// Use mock Redis in development/test, real Redis in production
if (process.env.NODE_ENV !== 'production' || process.env.MOCK_REDIS === 'true') {
  logger.info('Using Mock Redis Cache (In-Memory)');
  CacheManager = require('./mockRedis').default;
} else {
  // Real Redis implementation
  const Redis = require('ioredis');

  class RedisCacheManager {
    private redis: any;

    constructor() {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected');
      });

      this.redis.on('error', (err: any) => {
        logger.error('Redis error', { error: err.message });
      });
    }

    async get<T>(key: string): Promise<T | null> {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        logger.error('Cache get error', { key, error });
        return null;
      }
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
      try {
        const serialized = JSON.stringify(value);
        if (ttl) {
          await this.redis.setex(key, ttl, serialized);
        } else {
          await this.redis.set(key, serialized);
        }
      } catch (error) {
        logger.error('Cache set error', { key, error });
      }
    }

    async del(key: string): Promise<void> {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.error('Cache delete error', { key, error });
      }
    }

    async clear(): Promise<void> {
      try {
        await this.redis.flushdb();
      } catch (error) {
        logger.error('Cache clear error', { error });
      }
    }

    async disconnect(): Promise<void> {
      try {
        await this.redis.quit();
        logger.info('Redis disconnected');
      } catch (error) {
        logger.error('Redis disconnect error', { error });
      }
    }

    getClient(): any {
      return this.redis;
    }
  }

  CacheManager = new RedisCacheManager();
}

// Ensure mock cache has all required methods
if (!CacheManager.get || typeof CacheManager.get !== 'function') {
  CacheManager.get = async () => null;
}
if (!CacheManager.set || typeof CacheManager.set !== 'function') {
  CacheManager.set = async () => {};
}
if (!CacheManager.del || typeof CacheManager.del !== 'function') {
  CacheManager.del = async () => {};
}
if (!CacheManager.clear || typeof CacheManager.clear !== 'function') {
  CacheManager.clear = async () => {};
}
if (!CacheManager.disconnect || typeof CacheManager.disconnect !== 'function') {
  CacheManager.disconnect = async () => {};
}

export default CacheManager;
