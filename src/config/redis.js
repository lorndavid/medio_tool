const IORedis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let connection = null;

function getRedis() {
  if (!env.redis.enabled) return null;
  if (connection) return connection;

  connection = new IORedis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
    lazyConnect: false,
  });

  connection.on('connect', () => logger.info('✅ Redis connected'));
  connection.on('error', (e) => logger.error('Redis error', { err: e.message }));

  return connection;
}

module.exports = { getRedis };
