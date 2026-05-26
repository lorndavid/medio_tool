process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '16';

const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { createBot } = require('./bot');
const queues = require('./queues');
const { processMediaJob } = require('./services/mediaProcessor');

(async function bootstrap() {
  try {
    await connectDB();

    // Initialize queue + processor
    queues.setProcessor(processMediaJob);
    await queues.init();

    // Initialize Telegram bot
    createBot();

    const app = createApp();
    const server = app.listen(env.port, () => {
      logger.info(`🚀 ${env.appName} listening on port ${env.port} [${env.nodeEnv}]`);
    });

    // graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} received. Shutting down...`);
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (err) => logger.error('uncaughtException', { err: err.message, stack: err.stack }));
    process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', { reason: String(reason) }));
  } catch (e) {
    logger.error('bootstrap failed', { err: e.message, stack: e.stack });
    process.exit(1);
  }
})();
