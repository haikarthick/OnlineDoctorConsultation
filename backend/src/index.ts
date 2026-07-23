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
 *
 * Gated on ENABLE_SELF_PING, NOT nodeEnv==='production'. Those are different questions —
 * "is this a production-configured deploy" says nothing about "should this service stay
 * warm 24/7." Tying them together meant there was no way to run a production-configured
 * service (security headers, disabled debug logging, etc.) without ALSO permanently eating
 * free-tier instance-hours. This conflation is exactly how a since-corrected root-cause
 * analysis of a June 2026 quota overrun (see memory: render-usage-root-cause-corrected,
 * MEMORY.md index) went unactioned for 5+ weeks — the fix needed an explicit on/off knob
 * independent of nodeEnv, not a change to nodeEnv itself.
 */
const startSelfPing = () => {
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (!externalUrl || process.env.ENABLE_SELF_PING !== 'true') {
    logger.info('[KeepAlive] Self-ping disabled (set ENABLE_SELF_PING=true to enable)');
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

    // ── Vaccinations table reminders ─────────────────────────────
    const sendVaccinationsTableReminders = async () => {
      try {
        const { default: db } = await import('./utils/database');
        const { default: NSvc } = await import('./services/NotificationService');
        const upcoming = await db.query(
          `SELECT v.id, v.animal_id as "animalId", v.vaccine_name as "vaccineName",
                  v.next_due_date as "nextDueDate",
                  a.name as "animalName", a.owner_id as "ownerId"
           FROM vaccination_records v
           JOIN animals a ON a.id = v.animal_id
           WHERE v.next_due_date = CURRENT_DATE + INTERVAL '7 days'
             AND v.is_valid = true`,
          []
        );
        for (const row of upcoming.rows) {
          try {
            const existing = await db.query(
              `SELECT id FROM notifications WHERE user_id = $1 AND type = 'reminder'
               AND metadata->>'vaccinationId' = $2 AND created_at > NOW() - INTERVAL '3 days'`,
              [row.ownerId, row.id]
            );
            if (existing.rows.length > 0) continue;
            await NSvc.createNotification(
              row.ownerId, 'reminder',
              `Vaccination Due in 7 Days`,
              `${row.animalName}'s ${row.vaccineName} vaccination is due on ${new Date(row.nextDueDate).toLocaleDateString()}. Please schedule an appointment.`,
              'all', { animalId: row.animalId, vaccinationId: row.id }
            );
          } catch { /* individual failures should not stop the loop */ }
        }
        if (upcoming.rows.length > 0) {
          logger.info(`[VaccinationReminder] Sent ${upcoming.rows.length} vaccination reminders`);
        }
      } catch (err: any) {
        logger.error('[VaccinationReminder] Job failed', { error: err.message });
      }
    };

    sendVaccinationsTableReminders().catch((err: any) => logger.warn('[VaccinationReminder] Initial run failed', { error: err.message }));
    setInterval(() => {
      sendVaccinationsTableReminders().catch((err: any) => logger.warn('[VaccinationReminder] Scheduled run failed', { error: err.message }));
    }, 24 * 60 * 60 * 1000);

    // Await fixDemoPasswords so admin/demo users have correct passwords
    // BEFORE the first login request arrives. Previously this fired async
    // causing "Invalid email or password" on fresh-DB deploys if login
    // was attempted before bcrypt hashes were corrected.
    // Gated on SEED_ON_STARTUP (not NODE_ENV, and not AuthController's
    // DEMO_SEED_ENABLED — that one isn't actually set anywhere in
    // render.yaml today, so gating on it here would have silently disabled
    // this on both currently-live environments). SEED_ON_STARTUP=true is
    // already set on both vetcare-dev and vetcare-demo specifically to mean
    // "this environment manages seeded demo data" (vetcare-demo runs
    // NODE_ENV=production on purpose, so a plain NODE_ENV check would wrongly
    // skip this there too). A real customer-facing production deploy should
    // not set SEED_ON_STARTUP=true, so this stays off there by default.
    if (String(process.env.SEED_ON_STARTUP).toLowerCase() === 'true') {
      try {
        await fixDemoPasswords();
        logger.info('fixDemoPasswords completed successfully');
      } catch (err: any) {
        logger.error('fixDemoPasswords failed on first attempt — retrying in 30s', { error: err.message || String(err) });
        setTimeout(() => {
          fixDemoPasswords().catch((err2: any) =>
            logger.error('fixDemoPasswords retry also failed', { error: err2.message || String(err2) })
          );
        }, 30000);
      }
    }

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
