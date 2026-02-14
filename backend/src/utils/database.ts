import config from '../config';
import logger from '../utils/logger';

// Use mock database for development if MOCK_DB is enabled
let Database: any;

if (process.env.MOCK_DB === 'true' || process.env.NODE_ENV === 'development') {
  logger.info('Using Mock Database (In-Memory)');
  Database = require('./mockDatabase').default;
} else {
  // Real PostgreSQL implementation
  const { Pool, Client } = require('pg');

  class PostgresDatabase {
    private pool: any;
    private client: any = null;

    constructor() {
      this.pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        max: config.database.pool.max,
        min: config.database.pool.min,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });

      this.pool.on('error', (err: any) => {
        logger.error('Unexpected error on idle client', { error: err.message });
      });
    }

    async connect(): Promise<void> {
      try {
        this.client = new Client({
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.database
        });
        await this.client.connect();
        logger.info('Database connected successfully');
      } catch (error) {
        logger.error('Failed to connect to database', { error });
        throw error;
      }
    }

    async disconnect(): Promise<void> {
      try {
        if (this.client) {
          await this.client.end();
        }
        await this.pool.end();
        logger.info('Database disconnected');
      } catch (error) {
        logger.error('Error disconnecting from database', { error });
        throw error;
      }
    }

    async query(text: string, params?: any[]): Promise<any> {
      const start = Date.now();
      try {
        const result = await this.pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
          logger.warn('Slow query detected', { query: text, duration, params });
        }
        return result;
      } catch (error) {
        logger.error('Database query error', { query: text, error });
        throw error;
      }
    }

    async transaction(callback: (client: any) => Promise<any>): Promise<any> {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Transaction failed', { error });
        throw error;
      } finally {
        client.release();
      }
    }

    getPool(): any {
      return this.pool;
    }
  }

  Database = new PostgresDatabase();
}

export default Database;
