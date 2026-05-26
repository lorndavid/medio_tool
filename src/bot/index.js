const TelegramBot = require('node-telegram-bot-api');
const env = require('../config/env');
const logger = require('../utils/logger');
const handlers = require('./handlers');
const { setBot } = require('../services/mediaProcessor');

let bot = null;

function createBot() {
  if (bot) return bot;

  const useWebhook = !!env.telegram.webhookDomain;

  if (useWebhook) {
    logger.info('🌍 Telegram bot starting in WEBHOOK mode');
    bot = new TelegramBot(env.telegram.token);
    bot.setWebHook(`${env.telegram.webhookDomain}/bot/${env.telegram.token}`).catch((e) =>
      logger.error('setWebHook failed', { err: e.message })
    );
  } else {
    logger.info('💻 Telegram bot starting in POLLING mode (dev)');
    bot = new TelegramBot(env.telegram.token, {
      polling: { interval: 500, autoStart: true, params: { timeout: 10 } },
    });
    bot.deleteWebHook().catch(() => {});
  }

  bot.on('polling_error', (e) =>
    logger.warn('polling_error', { code: e.code, message: e.message })
  );
  bot.on('webhook_error', (e) =>
    logger.warn('webhook_error', { code: e.code, message: e.message })
  );

  handlers.register(bot);
  setBot(bot);

  return bot;
}

function getBot() {
  if (!bot) throw new Error('Bot not initialized');
  return bot;
}

module.exports = { createBot, getBot };
