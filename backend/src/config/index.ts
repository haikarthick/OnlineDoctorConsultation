import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Re-export feature flags so they're accessible from config
export { featureFlags, isFeatureEnabled, getAllFeatureFlags } from './featureFlags';

// ── Production Environment Validation ────────────────────────
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  const required: string[] = ['JWT_SECRET', 'DB_PASSWORD', 'DB_HOST', 'CORS_ORIGIN'];
  const missing = required.filter(k => !process.env[k] || process.env[k]?.startsWith('CHANGE_ME'));
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required production env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  // Warn on dangerous defaults
  if (process.env.JWT_SECRET === 'change-this-in-production' || process.env.JWT_SECRET === 'dev-jwt-secret-do-not-use-in-production') {
    console.error('[FATAL] JWT_SECRET must be changed from default value in production.');
    process.exit(1);
  }
  if (process.env.DB_PASSWORD === 'postgres' || process.env.DB_PASSWORD === 'postgres123') {
    console.error('[FATAL] DB_PASSWORD must not use default value in production.');
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
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'veterinary_consultation',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT || '5000', 10),
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

export default config;
