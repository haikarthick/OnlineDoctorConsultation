import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Re-export feature flags so they're accessible from config
export { featureFlags, isFeatureEnabled, getAllFeatureFlags } from './featureFlags';

// Use a deterministic fallback JWT secret for development so tokens survive restarts.
// In production, JWT_SECRET MUST be set via environment variable.
const jwtFallback = 'dev-jwt-secret-do-not-use-in-production';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] JWT_SECRET environment variable is required in production.');
  process.exit(1);
}

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
      max: parseInt(process.env.DB_POOL_MAX || '10', 10)
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET || jwtFallback,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: process.env.CORS_CREDENTIALS !== 'false'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

export default config;
