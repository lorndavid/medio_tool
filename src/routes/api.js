const express = require('express');
const env = require('../config/env');
const { getBot } = require('../bot');
const logger = require('../utils/logger');

const router = express.Router();

// Telegram webhook (only used in production when TELEGRAM_WEBHOOK_DOMAIN is set)
router.post(`/bot/${env.telegram.token}`, (req, res) => {
  try {
    const bot = getBot();
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (e) {
    logger.error('webhook update failed', { err: e.message });
    res.sendStatus(500);
  }
});

router.get('/status', (req, res) => {
  res.json({ ok: true, app: env.appName, version: '1.0.0' });
});

module.exports = router;
