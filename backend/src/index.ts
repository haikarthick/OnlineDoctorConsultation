import app from './app';
import config from './config';
import logger from './utils/logger';
import database from './utils/database';
import cacheManager from './utils/cacheManager';

const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    logger.info('Database initialized');

    // Initialize cache
    logger.info('Cache initialized');

    // Start server
    app.listen(config.app.port, () => {
      logger.info(`Server running on port ${config.app.port} in ${config.app.nodeEnv} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
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

startServer();
