/**
 * PM2 process file for MediaFlow Bot.
 *
 * - mediaflow-app: HTTP + Telegram bot (polling or webhook) + inline queue.
 *   Runs always.
 *
 * - mediaflow-worker: dedicated BullMQ worker. Only useful when REDIS_ENABLED=true.
 *   Set REDIS_ENABLED=false in .env to skip starting it (it would just exit).
 */
require('dotenv').config();

const apps = [
  {
    name: 'mediaflow-app',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '420M',
    env: { NODE_ENV: 'production' },
    out_file: 'logs/pm2-out.log',
    error_file: 'logs/pm2-err.log',
    merge_logs: true,
    time: true,
    kill_timeout: 8000,
    autorestart: true,
    max_restarts: 20,
    restart_delay: 4000,
  },
];

if (String(process.env.REDIS_ENABLED || 'false').toLowerCase() === 'true') {
  apps.push({
    name: 'mediaflow-worker',
    script: 'src/queues/worker.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production', QUEUE_WORKER: '1', QUEUE_CONCURRENCY: '4' },
    out_file: 'logs/pm2-worker-out.log',
    error_file: 'logs/pm2-worker-err.log',
    autorestart: true,
    max_restarts: 20,
    restart_delay: 4000,
  });
}

module.exports = { apps };
