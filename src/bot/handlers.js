const User = require('../models/User');
const MediaHistory = require('../models/MediaHistory');
const Settings = require('../models/Settings');
const SupportTicket = require('../models/SupportTicket');
const { t } = require('../services/i18n');
const linkRouter = require('../services/linkRouter');
const userService = require('../services/userService');
const analytics = require('../services/analyticsService');
const queues = require('../queues');
const { mainMenu, languageMenu, backHome, settingsMenu } = require('./keyboards');
const logger = require('../utils/logger');

const APP_VERSION = '1.0.0';

function register(bot) {
  // Set bot command list (one-time)
  bot.setMyCommands([
    { command: 'start', description: '🚀 Start' },
    { command: 'help', description: '❓ How to use' },
    { command: 'settings', description: '⚙️ Settings' },
    { command: 'profile', description: '👤 Your profile' },
    { command: 'language', description: '🌐 Language' },
    { command: 'support', description: '💬 Support' },
    { command: 'premium', description: '💎 Premium' },
    { command: 'stats', description: '📊 Stats' },
    { command: 'history', description: '🗂 History' },
    { command: 'about', description: 'ℹ️ About' },
  ]).catch(() => {});

  bot.onText(/^\/start(?:@\w+)?(?:\s|$)/, async (msg) => withUser(bot, msg, async (user, lang) => {
    await analytics.track('user_join', { telegramId: user.telegramId, languageCode: user.languageCode });
    await bot.sendMessage(msg.chat.id, t('welcome', { name: user.firstName || 'friend' }, lang), {
      parse_mode: 'Markdown',
      reply_markup: mainMenu(lang),
    });
  }));

  bot.onText(/^\/help/, (msg) => withUser(bot, msg, async (_u, lang) => {
    await bot.sendMessage(msg.chat.id, t('help', {}, lang), { parse_mode: 'Markdown', reply_markup: backHome(lang) });
  }));

  bot.onText(/^\/about/, (msg) => withUser(bot, msg, async (_u, lang) => {
    await bot.sendMessage(msg.chat.id, t('about', { version: APP_VERSION }, lang), { parse_mode: 'Markdown', reply_markup: backHome(lang) });
  }));

  bot.onText(/^\/language/, (msg) => withUser(bot, msg, async (_u, lang) => {
    await bot.sendMessage(msg.chat.id, t('language.prompt', {}, lang), { reply_markup: languageMenu() });
  }));

  bot.onText(/^\/profile/, (msg) => withUser(bot, msg, (u, lang) => sendProfile(bot, msg.chat.id, u, lang)));
  bot.onText(/^\/settings/, (msg) => withUser(bot, msg, (u, lang) => sendSettings(bot, msg.chat.id, u, lang)));
  bot.onText(/^\/history/, (msg) => withUser(bot, msg, (u, lang) => sendHistory(bot, msg.chat.id, u, lang)));
  bot.onText(/^\/stats/, (msg) => withUser(bot, msg, (u, lang) => sendStats(bot, msg.chat.id, u, lang)));
  bot.onText(/^\/premium/, (msg) => withUser(bot, msg, async (_u, lang) => {
    await bot.sendMessage(msg.chat.id, t('premium', {}, lang), { parse_mode: 'Markdown', reply_markup: backHome(lang) });
  }));
  bot.onText(/^\/support(?:\s+(.+))?/, (msg, match) => withUser(bot, msg, async (user, lang) => {
    if (match && match[1]) {
      const subject = match[1].slice(0, 80);
      await SupportTicket.create({
        telegramId: user.telegramId,
        user: user._id,
        subject,
        messages: [{ from: 'user', body: match[1] }],
      });
      await bot.sendMessage(msg.chat.id, '✅ Ticket created.');
      return;
    }
    await bot.sendMessage(msg.chat.id, t('support', {}, lang), { parse_mode: 'Markdown' });
  }));

  // Plain text -> link router
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    await withUser(bot, msg, async (user, lang) => handleText(bot, msg, user, lang));
  });

  bot.on('callback_query', (q) => handleCallback(bot, q));
}

async function withUser(bot, msg, fn) {
  try {
    if (!msg.from) return;
    const user = await userService.findOrCreate(msg.from);
    if (user.isBanned) {
      await bot.sendMessage(msg.chat.id, t('errors.banned', {}, user.languageCode));
      return;
    }
    const settings = await Settings.get();
    if (settings.maintenance) {
      await bot.sendMessage(msg.chat.id, settings.maintenanceMessage || t('errors.maintenance', {}, user.languageCode));
      return;
    }
    await fn(user, user.languageCode || 'en');
  } catch (err) {
    logger.error('handler error', { err: err.message, stack: err.stack });
  }
}

async function handleText(bot, msg, user, lang) {
  const detected = linkRouter.detect(msg.text);
  if (!detected) {
    return; // ignore non-link messages
  }

  // rate limit
  const settings = await Settings.get();
  if (!userService.checkRateLimit(user.telegramId, settings.rateLimits?.perUserPerMinute || 10)) {
    await bot.sendMessage(msg.chat.id, t('errors.rateLimit', {}, lang));
    return;
  }

  const platformEnabled = settings.enabledPlatforms?.[detected.platform];
  if (platformEnabled === false) {
    await bot.sendMessage(msg.chat.id, t('errors.platformDisabled', {}, lang));
    return;
  }

  const status = await bot.sendMessage(msg.chat.id, t('processing', {}, lang), { parse_mode: 'Markdown' });

  await analytics.track('download_request', {
    telegramId: user.telegramId,
    platform: detected.platform,
    languageCode: lang,
  });

  await queues.getQueue().add('media', {
    telegramId: user.telegramId,
    chatId: msg.chat.id,
    statusMessageId: status.message_id,
    platform: detected.platform,
    url: detected.url,
    lang,
    // Audio-only is YouTube-only. Other platforms always return video.
    audioOnly: detected.platform === 'youtube' && !!user.settings?.audioOnly,
    preferHD: user.settings?.preferHD !== false,
    userId: user._id,
  });
}

async function handleCallback(bot, q) {
  try {
    const user = await userService.findOrCreate(q.from);
    const lang = user.languageCode || 'en';
    const chatId = q.message.chat.id;
    const action = q.data;

    if (action === 'menu:home') {
      await bot.editMessageText(t('welcome', { name: user.firstName || 'friend' }, lang), {
        chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown', reply_markup: mainMenu(lang),
      }).catch(() => {});
    } else if (action === 'menu:profile') {
      await sendProfile(bot, chatId, user, lang, q.message.message_id);
    } else if (action === 'menu:settings') {
      await sendSettings(bot, chatId, user, lang, q.message.message_id);
    } else if (action === 'menu:language') {
      await bot.editMessageText(t('language.prompt', {}, lang), {
        chat_id: chatId, message_id: q.message.message_id, reply_markup: languageMenu(),
      }).catch(() => {});
    } else if (action === 'menu:history') {
      await sendHistory(bot, chatId, user, lang, q.message.message_id);
    } else if (action === 'menu:stats') {
      await sendStats(bot, chatId, user, lang, q.message.message_id);
    } else if (action === 'menu:premium') {
      await bot.editMessageText(t('premium', {}, lang), { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown', reply_markup: backHome(lang) }).catch(() => {});
    } else if (action === 'menu:about') {
      await bot.editMessageText(t('about', { version: APP_VERSION }, lang), { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown', reply_markup: backHome(lang) }).catch(() => {});
    } else if (action === 'menu:support') {
      await bot.editMessageText(t('support', {}, lang), { chat_id: chatId, message_id: q.message.message_id, parse_mode: 'Markdown', reply_markup: backHome(lang) }).catch(() => {});
    } else if (action.startsWith('lang:')) {
      const code = action.split(':')[1];
      await userService.setLanguage(user.telegramId, code);
      await analytics.track('language_change', { telegramId: user.telegramId, languageCode: code });
      await bot.editMessageText(t('language.saved', {}, code), { chat_id: chatId, message_id: q.message.message_id, reply_markup: mainMenu(code) }).catch(() => {});
    } else if (action.startsWith('set:')) {
      const key = action.split(':')[1];
      const updated = await userService.toggleSetting(user.telegramId, key);
      if (updated) {
        await bot.editMessageReplyMarkup(settingsMenu(updated, lang), { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
      }
    }

    await bot.answerCallbackQuery(q.id).catch(() => {});
  } catch (err) {
    logger.error('callback error', { err: err.message });
    bot.answerCallbackQuery(q.id, { text: 'Error' }).catch(() => {});
  }
}

async function sendProfile(bot, chatId, user, lang, editMessageId) {
  const lines = [
    t('profile.title', {}, lang),
    `👤 ${t('profile.name', {}, lang)}: ${escapeMD(user.firstName || '')}`,
    `🌐 ${t('profile.language', {}, lang)}: ${user.languageCode}`,
    `📥 ${t('profile.downloads', {}, lang)}: ${user.downloads}`,
    `📅 ${t('profile.joined', {}, lang)}: ${new Date(user.createdAt).toISOString().slice(0, 10)}`,
    `🏷 ${t('profile.tier', {}, lang)}: ${user.role}${user.isPremium ? ' • 💎' : ''}`,
  ].join('\n');
  return sendOrEdit(bot, chatId, editMessageId, lines, backHome(lang));
}

async function sendSettings(bot, chatId, user, lang, editMessageId) {
  return sendOrEdit(bot, chatId, editMessageId, t('settings.title', {}, lang), settingsMenu(user, lang));
}

async function sendHistory(bot, chatId, user, lang, editMessageId) {
  const items = await MediaHistory.find({ telegramId: user.telegramId }).sort({ createdAt: -1 }).limit(5).lean();
  let body = `${t('history.title', {}, lang)}\n\n`;
  if (!items.length) body += t('history.empty', {}, lang);
  else {
    body += items.map((it, i) => `${i + 1}. ${platformIcon(it.platform)} ${escapeMD(it.title || it.platform)} — ${it.status}`).join('\n');
  }
  return sendOrEdit(bot, chatId, editMessageId, body, backHome(lang));
}

async function sendStats(bot, chatId, user, lang, editMessageId) {
  const total = await MediaHistory.countDocuments({ telegramId: user.telegramId });
  const ok = await MediaHistory.countDocuments({ telegramId: user.telegramId, status: 'success' });
  const rate = total ? Math.round((ok / total) * 100) : 0;
  const body = [
    t('stats.title', {}, lang),
    `📥 ${t('stats.downloads', {}, lang)}: ${total}`,
    `✅ ${t('stats.successRate', {}, lang)}: ${rate}%`,
  ].join('\n');
  return sendOrEdit(bot, chatId, editMessageId, body, backHome(lang));
}

async function sendOrEdit(bot, chatId, messageId, text, replyMarkup) {
  if (messageId) {
    return bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: replyMarkup }).catch(() => {});
  }
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
}

function platformIcon(p) {
  return ({ tiktok: '🎵', instagram: '📸', facebook: '📘', youtube: '▶️' }[p] || '📦');
}

function escapeMD(str = '') {
  return String(str).replace(/([_*`\[\]])/g, '\\$1');
}

module.exports = { register };
