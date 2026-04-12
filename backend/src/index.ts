import http from 'http';
import https from 'https';
import app from './app';
import config from './config';
import logger from './utils/logger';
import database from './utils/database';
import cacheManager from './utils/cacheManager';
import { initSocketIO } from './utils/socketIO';
import { startScheduler } from './utils/scheduler';
import { fixDemoPasswords } from './utils/fixDemoPasswords';
import VaccineScheduleService from './services/VaccineScheduleService';

/**
 * Self-ping keep-alive for Render free-tier.
 * Render spins down services after 15 min of inactivity (no incoming HTTP).
 * GitHub Actions cron is unreliable (can be delayed 10-30+ min).
 * Solution: ping our OWN external URL every 10 min from inside the process.
 * Render's load balancer sees it as a real incoming request → resets idle timer.
 * Uses built-in `https` module — no extra dependencies.
 */
const startSelfPing = () => {
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (!externalUrl || config.app.nodeEnv !== 'production') {
    logger.info('[KeepAlive] Self-ping disabled (not on Render production)');
    return;
  }

  const pingUrl = `${externalUrl}/api/v1/health`;
  const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  const doPing = () => {
    const req = https.get(pingUrl, { timeout: 10000 }, res => {
      logger.info(`[KeepAlive] Self-ping → HTTP ${res.statusCode}`);
      res.resume(); // drain response so connection closes
    });
    req.on('error', err => logger.warn(`[KeepAlive] Self-ping failed: ${err.message}`));
    req.on('timeout', () => { req.destroy(); logger.warn('[KeepAlive] Self-ping timed out'); });
  };

  // First ping after 5 min (let server fully warm up first)
  setTimeout(doPing, 5 * 60 * 1000);
  // Then every 10 min
  setInterval(doPing, INTERVAL_MS);

  logger.info(`[KeepAlive] Self-ping scheduled every 10 min → ${pingUrl}`);
};

/** Retry database.connect() with exponential backoff.
 *  Free-tier Render PostgreSQL can be slow to respond after restarts.
 *  10 attempts at 12-second intervals = up to 120 seconds before giving up.
 */
const connectWithRetry= async (maxAttempts = 10): Promise<void> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await database.connect();
      return;
    } catch (err: any) {
      if (attempt === maxAttempts) throw err;
      logger.warn(`DB connect attempt ${attempt}/${maxAttempts} failed — retrying in 12s`, { error: err.message });
      await new Promise(r => setTimeout(r, 12000));
    }
  }
};

const startServer = async () => {
  // ── 1. Bind HTTP port FIRST so Render's health check passes immediately ──
  // On Render free tier, DB can take 30-60s to wake up. If the port isn't
  // bound before Render's health check fires, the deploy is marked as failed.
  const httpServer = http.createServer(app);
  initSocketIO(httpServer);

  const server = httpServer.listen(config.app.port, () => {
    logger.info(`Server running on port ${config.app.port} in ${config.app.nodeEnv} mode`);
  });

  server.on('error', (err: any) => {
    logger.error('Server error', { error: err.message });
    process.exit(1);
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      try {
        await database.disconnect();
        await cacheManager.disconnect();
        logger.info('Server shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ── 2. Initialize DB + services in background (does NOT block port binding) ──
  try {
    await connectWithRetry();
    logger.info('Database initialized');

    if (cacheManager.connect) {
      await cacheManager.connect();
    }
    logger.info('Cache initialized');

    startScheduler();

    VaccineScheduleService.runDailyReminderJob().catch((err: any) =>
      logger.warn('[VaccineSchedule] Initial reminder job failed', { error: err.message })
    );
    setInterval(() => {
      VaccineScheduleService.runDailyReminderJob().catch((err: any) =>
        logger.warn('[VaccineSchedule] Scheduled reminder job failed', { error: err.message })
      );
    }, 24 * 60 * 60 * 1000);

    fixDemoPasswords().catch((err: any) => {
      logger.error('fixDemoPasswords failed on first attempt — will retry in 30s', { error: err.message || String(err) });
      setTimeout(() => {
        fixDemoPasswords().catch((err2: any) =>
          logger.error('fixDemoPasswords retry also failed', { error: err2.message || String(err2) })
        );
      }, 30000);
    });

    // Keep Render free-tier awake — self-ping every 10 min via external URL
    startSelfPing();
  } catch (error: any) {
    logger.error('Failed to initialize services after server start', { error: error.message || String(error) });
    // Do NOT exit — server is already listening; DB may recover on its own
  }
};

// Handle unhandled promise rejections — log but do NOT crash.
// Crashing on transient DB/network errors kills the server and causes
// cascading ECONNREFUSED errors for every connected client.
process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason });
});

// Handle uncaught exceptions — log but do NOT crash.
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  // Only exit for truly fatal low-level errors (out of memory, etc.)
  if (err.message?.includes('out of memory') || err.message?.includes('ENOMEM')) {
    process.exit(1);
  }
});

startServer();
