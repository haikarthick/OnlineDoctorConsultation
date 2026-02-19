/**
 * Production-Ready In-Memory Cache
 * ================================
 * High-performance in-memory cache with TTL support.
 * Suitable for single-server deployments. For multi-server,
 * swap this for Redis via the same interface.
 */

import logger from './logger';

class MemoryCache {
  private cache: Map<string, { value: any; expiresAt?: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.purgeExpired(), 60_000);
  }

  async connect(): Promise<void> {
    logger.info('In-memory cache initialized');
  }

  async disconnect(): Promise<void> {
    this.cache.clear();
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    logger.info('In-memory cache cleared');
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return (typeof entry.value === 'string' ? entry.value : JSON.parse(JSON.stringify(entry.value))) as T;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<number> {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return 0;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return 0;
    }
    return 1;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  /** Remove all expired entries */
  private purgeExpired(): void {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
        purged++;
      }
    }
    if (purged > 0) {
      logger.debug(`Cache: purged ${purged} expired entries, ${this.cache.size} remaining`);
    }
  }

  /** Get cache statistics */
  getStats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

export default new MemoryCache();
