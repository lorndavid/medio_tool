const Broadcast = require('../models/Broadcast');
const User = require('../models/User');
const { getBot } = require('../bot');
const logger = require('../utils/logger');

async function send(req, res) {
  const { title, body, audience, languageCode, countryCode } = req.body;
  if (!body) return res.status(400).render('admin/broadcast', { error: 'Body required' });

  const filter = {};
  if (audience === 'language' && languageCode) filter.languageCode = languageCode;
  else if (audience === 'country' && countryCode) filter.countryCode = countryCode;
  else if (audience === 'active') filter.lastActive = { $gte: new Date(Date.now() - 7 * 86400000) };
  filter.isBanned = { $ne: true };

  const total = await User.countDocuments(filter);
  const bc = await Broadcast.create({
    title,
    body,
    audience,
    audienceFilter: filter,
    sentBy: req.adminId,
    stats: { total, delivered: 0, failed: 0 },
    status: 'sending',
  });

  // Fire and forget. In production use BullMQ for resumability.
  setImmediate(() => doSend(bc._id, filter, body).catch((e) => logger.error('broadcast failed', { err: e.message })));

  res.redirect('/admin/broadcast');
}

async function doSend(id, filter, body) {
  const bot = getBot();
  const cursor = User.find(filter).cursor();
  let delivered = 0, failed = 0;
  for await (const u of cursor) {
    try {
      await bot.sendMessage(u.telegramId, body, { parse_mode: 'Markdown' });
      delivered++;
    } catch (_) {
      failed++;
    }
    if ((delivered + failed) % 25 === 0) {
      await Broadcast.updateOne({ _id: id }, { $set: { 'stats.delivered': delivered, 'stats.failed': failed } });
    }
    // Telegram global limit: 30 msgs/s. Sleep ~40ms between sends.
    await new Promise((r) => setTimeout(r, 40));
  }
  await Broadcast.updateOne({ _id: id }, {
    $set: { 'stats.delivered': delivered, 'stats.failed': failed, status: 'done' },
  });
}

module.exports = { send };
