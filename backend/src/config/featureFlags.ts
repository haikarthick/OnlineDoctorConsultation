/**
 * Feature Flags Configuration
 * ============================
 * Centralized ON/OFF toggles for all optional features.
 * 
 * For initial go-live, only MANDATORY features are enabled (all flags default OFF).
 * Enable features as you scale by setting the corresponding environment variable to 'true'.
 * 
 * Environment Variables:
 *   FEATURE_REDIS_CACHE=true        → Use real Redis instead of in-memory mock
 *   FEATURE_PAYMENTS=true           → Enable Stripe payment processing
 *   FEATURE_EMAIL_NOTIFICATIONS=true → Enable email sending (SendGrid/SES)
 *   FEATURE_FILE_STORAGE=true       → Enable S3/cloud file uploads
 *   FEATURE_REALTIME_CHAT=true      → Enable Socket.io real-time chat
 *   FEATURE_OAUTH_SSO=true          → Enable Google/Facebook OAuth login
 *   FEATURE_TWO_FACTOR_AUTH=true    → Enable TOTP 2FA/MFA
 *   FEATURE_AUDIT_LOGGING=true      → Enable database audit trail
 *   FEATURE_RATE_LIMITING=true      → Enable advanced rate limiting per user
 *   FEATURE_ANALYTICS=true          → Enable analytics dashboard
 */

export interface FeatureFlags {
  // --- Core (always ON, cannot be toggled) ---
  // auth, consultations, users, medical records → always enabled

  // --- Optional features (OFF by default for zero-cost go-live) ---
  redisCache: boolean;
  payments: boolean;
  emailNotifications: boolean;
  fileStorage: boolean;
  realtimeChat: boolean;
  oauthSSO: boolean;
  twoFactorAuth: boolean;
  auditLogging: boolean;
  advancedRateLimiting: boolean;
  analytics: boolean;
}

function envBool(key: string, defaultValue: boolean = false): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1';
}

export const featureFlags: FeatureFlags = {
  redisCache: envBool('FEATURE_REDIS_CACHE'),
  payments: envBool('FEATURE_PAYMENTS'),
  emailNotifications: envBool('FEATURE_EMAIL_NOTIFICATIONS'),
  fileStorage: envBool('FEATURE_FILE_STORAGE'),
  realtimeChat: envBool('FEATURE_REALTIME_CHAT'),
  oauthSSO: envBool('FEATURE_OAUTH_SSO'),
  twoFactorAuth: envBool('FEATURE_TWO_FACTOR_AUTH'),
  auditLogging: envBool('FEATURE_AUDIT_LOGGING'),
  advancedRateLimiting: envBool('FEATURE_ADVANCED_RATE_LIMITING'),
  analytics: envBool('FEATURE_ANALYTICS'),
};

/**
 * Check if a specific feature is enabled at runtime
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}

/**
 * Get all feature flags for the /health or /features endpoint
 */
export function getAllFeatureFlags(): FeatureFlags {
  return { ...featureFlags };
}

/**
 * Middleware guard: returns 404 if feature is disabled
 */
export function requireFeature(flag: keyof FeatureFlags) {
  return (req: any, res: any, next: any) => {
    if (!featureFlags[flag]) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Feature '${flag}' is not enabled. Set FEATURE_${flag.replace(/([A-Z])/g, '_$1').toUpperCase()}=true to enable.`,
          code: 'FEATURE_DISABLED',
          statusCode: 404,
        },
      });
    }
    next();
  };
}

export default featureFlags;
