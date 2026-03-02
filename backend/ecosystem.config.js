/**
 * PM2 Ecosystem Configuration
 *
 * Usage:
 *   npm run start:pm2          # uses this config
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js   # zero-downtime reload
 *   pm2 stop all
 *   pm2 logs vetcare-api
 *
 * Install PM2 globally: npm install -g pm2
 */
module.exports = {
  apps: [
    {
      name: 'vetcare-api',
      script: 'dist/index.js',
      instances: process.env.CLUSTER_WORKERS || 'max', // 'max' = one per CPU core
      exec_mode: 'cluster',
      max_memory_restart: '512M',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,

      // Graceful restart
      kill_timeout: 10000,
      listen_timeout: 8000,
      wait_ready: false,

      // Auto-restart on failure
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,

      // Watch (disabled in production — use pm2 reload for deploys)
      watch: false,
    },
  ],
};
