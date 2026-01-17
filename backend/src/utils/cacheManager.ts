import Redis from 'ioredis';
import config from '../config';
import logger from './logger';

class CacheManager {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redis.on('error', (err) => {
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

  getClient(): Redis {
    return this.redis;
  }
}

export default new CacheManager();
