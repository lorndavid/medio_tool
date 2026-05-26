const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      autoIndex: !env.isProd, // turn off in prod once indexes are stable
    });
    logger.info('✅ MongoDB connected');
  } catch (err) {
    logger.error('❌ MongoDB connection failed', { err: err.message, code: err.code, name: err.name });
    if (err.reason) {
      // Atlas SRV / TLS errors usually carry rich detail in `reason`
      logger.error('MongoDB reason', { reason: err.reason?.message || String(err.reason) });
    }
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
}

module.exports = { connectDB, mongoose };
