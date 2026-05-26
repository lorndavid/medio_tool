const AnalyticsEvent = require('../models/AnalyticsEvent');
const logger = require('../utils/logger');

async function track(type, payload = {}) {
  try {
    await AnalyticsEvent.create({ type, ...payload });
  } catch (e) {
    logger.warn('analytics track failed', { err: e.message });
  }
}

module.exports = { track };
