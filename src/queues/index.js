/**
 * Queue abstraction. Uses BullMQ when REDIS_ENABLED=true; otherwise an inline runner
 * that processes jobs immediately (good for tiny Oracle Free Tier setups).
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const { getRedis } = require('../config/redis');

const QUEUE_NAME = 'media-jobs';

let queueImpl = null;
let processFn = null;

function setProcessor(fn) {
  processFn = fn;
}

async function inlineAdd(name, data) {
  if (!processFn) throw new Error('Queue processor not registered');
  // Run in microtask to avoid blocking caller
  setImmediate(async () => {
    try {
      await processFn({ id: `inline-${Date.now()}`, name, data });
    } catch (err) {
      logger.error('Inline job failed', { err: err.message });
    }
  });
  return { id: `inline-${Date.now()}` };
}

async function init() {
  if (!env.redis.enabled) {
    logger.info('Queue: inline mode (no Redis).');
    queueImpl = { add: inlineAdd };
    return queueImpl;
  }

  const { Queue, Worker } = require('bullmq');
  const connection = getRedis();

  const q = new Queue(QUEUE_NAME, { connection });
  queueImpl = {
    add: (name, data, opts) => q.add(name, data, { removeOnComplete: 200, removeOnFail: 500, attempts: 2, ...opts }),
    raw: q,
  };

  // Worker
  if (process.env.QUEUE_WORKER === '1' || process.env.QUEUE_WORKER === 'true') {
    new Worker(
      QUEUE_NAME,
      async (job) => {
        if (!processFn) throw new Error('Queue processor not registered in worker');
        return processFn(job);
      },
      { connection, concurrency: Number(process.env.QUEUE_CONCURRENCY || 4) }
    );
    logger.info('BullMQ worker started');
  }

  logger.info('Queue: BullMQ mode');
  return queueImpl;
}

function getQueue() {
  if (!queueImpl) throw new Error('Queue not initialized');
  return queueImpl;
}

module.exports = { init, setProcessor, getQueue, QUEUE_NAME };
