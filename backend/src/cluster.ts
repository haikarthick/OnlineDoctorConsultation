/**
 * Cluster-mode entry point for non-containerised deployments.
 *
 * Spawns one worker per CPU core (or per CLUSTER_WORKERS env var) so the
 * Node.js event loop can utilise all available cores.
 *
 * Usage:
 *   node dist/cluster.js          # compiled JS
 *   npx ts-node src/cluster.ts    # development
 *
 * In Docker / ECS Fargate you should NOT use cluster mode — scale
 * horizontally with multiple containers instead.
 */
import cluster from 'cluster';
import os from 'os';

const WORKERS = parseInt(process.env.CLUSTER_WORKERS || '0', 10) || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} starting ${WORKERS} workers...`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(
      `[cluster] Worker ${worker.process.pid} exited (code=${code}, signal=${signal}). Restarting...`
    );
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`[cluster] Worker ${worker.process.pid} online`);
  });
} else {
  // Each worker runs the normal server entry point
  require('./index');
}
