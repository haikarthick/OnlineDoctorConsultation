import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Re-export feature flags so they're accessible from config
export { featureFlags, isFeatureEnabled, getAllFeatureFlags } from './featureFlags';

// ── Production Environment Validation ────────────────────────
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // DATABASE_URL (from Render/Heroku) satisfies DB connection requirements
  const hasDbUrl = !!process.env.DATABASE_URL;
  if (!hasDbUrl && !process.env.DB_HOST) {
    console.error('[FATAL] Neither DATABASE_URL nor DB_HOST is set. Cannot connect to database.');
    process.exit(1);
  }
  // Warn on dangerous JWT defaults
  if (process.env.JWT_SECRET === 'change-this-in-production' || process.env.JWT_SECRET === 'dev-jwt-secret-do-not-use-in-production') {
    console.error('[FATAL] JWT_SECRET must be changed from default value in production.');
    process.exit(1);
  }
}

// Use a deterministic fallback JWT secret for development so tokens survive restarts.
// In production, JWT_SECRET MUST be set via environment variable.
const jwtFallback = 'dev-jwt-secret-do-not-use-in-production';

export const config = {
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: process.env.API_VERSION || 'v1'
  },
  database: {
    // Render.com provides DATABASE_URL; when set, it takes precedence
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'veterinary_consultation',
    schema: process.env.DB_SCHEMA || 'public',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '1', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT || '30000', 10),
      maxUses: parseInt(process.env.DB_POOL_MAX_USES || '7500', 10)
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET || jwtFallback,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  cors: {
    origin: (() => {
      const raw = process.env.CORS_ORIGIN || 'http://localhost:5173';
      const isLocalhost = raw.includes('localhost') || raw.includes('127.0.0.1');

      // In production, if CORS_ORIGIN is still a localhost value (from .env default),
      // auto-detect from Render's URL or allow same-origin
      if (isProd && isLocalhost) {
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        if (renderUrl) return renderUrl;
        // Fallback: reflect request origin (same-origin since backend serves frontend)
        return true as any;
      }
      // Support multiple origins: comma-separated list → array
      const origins = raw.split(',').map(o => o.trim()).filter(Boolean);
      return origins.length === 1 ? origins[0] : origins;
    })(),
    credentials: process.env.CORS_CREDENTIALS !== 'false'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

/**
 * Resolve the public frontend URL at runtime.
 * In production: FRONTEND_URL (if non-localhost) → RENDER_EXTERNAL_URL → localhost fallback
 */
export function getFrontendUrl(): string {
  const envUrl = process.env.FRONTEND_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  if (isProd) {
    return process.env.RENDER_EXTERNAL_URL || envUrl || 'http://localhost:5173';
  }
  return envUrl || 'http://localhost:5173';
}

export default config;
