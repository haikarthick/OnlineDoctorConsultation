/**
 * Cache Manager
 * =============
 * Thin wrapper that re-exports the in-memory cache.
 * If you later need Redis/Valkey for multi-server deploys,
 * swap the import here — every consumer stays unchanged.
 */
import memoryCache from './memoryCache';

export default memoryCache;
