/**
 * Standalone worker entrypoint (used when REDIS_ENABLED=true).
 * Run with: QUEUE_WORKER=1 node src/queues/worker.js
 */
process.env.QUEUE_WORKER = '1';

const env = require('../config/env');
const logger = require('../utils/logger');
const { connectDB } = require('../config/db');
const queues = require('./index');
const { processMediaJob } = require('../services/mediaProcessor');

(async () => {
  await connectDB();
  queues.setProcessor(processMediaJob);
  await queues.init();
  logger.info(`Worker ready. Concurrency=${process.env.QUEUE_CONCURRENCY || 4}`);
})();
