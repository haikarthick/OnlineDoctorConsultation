import http from 'http';
import app from './app';
import config from './config';
import logger from './utils/logger';
import database from './utils/database';
import cacheManager from './utils/cacheManager';
import { initSocketIO } from './utils/socketIO';

const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    logger.info('Database initialized');

    // Initialize cache
    if (cacheManager.connect) {
      await cacheManager.connect();
    }
    logger.info('Cache initialized');

    // Start server
    const httpServer = http.createServer(app);
    initSocketIO(httpServer);

    const server = httpServer.listen(config.app.port, () => {
      logger.info(`Server running on port ${config.app.port} in ${config.app.nodeEnv} mode`);
    });

    // Handle server errors
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
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message || String(error) });
    process.exit(1);
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
