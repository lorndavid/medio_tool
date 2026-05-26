const User = require('../models/User');
const { pickLang } = require('./i18n');

const SIMPLE_RATE = new Map(); // telegramId -> { count, ts }

async function findOrCreate(tgUser) {
  const update = {
    username: tgUser.username,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
    lastActive: new Date(),
  };
  const onInsert = {
    telegramId: tgUser.id,
    languageCode: pickLang(tgUser.language_code),
  };
  const user = await User.findOneAndUpdate(
    { telegramId: tgUser.id },
    { $set: update, $setOnInsert: onInsert },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return user;
}

async function setLanguage(telegramId, code) {
  return User.findOneAndUpdate({ telegramId }, { $set: { languageCode: code } }, { new: true });
}

async function toggleSetting(telegramId, key) {
  const allowed = ['preferHD', 'audioOnly', 'notify'];
  if (!allowed.includes(key)) return null;
  const user = await User.findOne({ telegramId });
  if (!user) return null;
  user.settings = user.settings || {};
  user.settings[key] = !user.settings[key];
  await user.save();
  return user;
}

async function incrementDownload(telegramId) {
  return User.updateOne({ telegramId }, { $inc: { downloads: 1 }, $set: { lastActive: new Date() } });
}

/**
 * Lightweight per-user rate limiter (in-memory).
 * @returns true if request is allowed
 */
function checkRateLimit(telegramId, perMinute = 10) {
  const now = Date.now();
  const slot = SIMPLE_RATE.get(telegramId);
  if (!slot || now - slot.ts > 60_000) {
    SIMPLE_RATE.set(telegramId, { count: 1, ts: now });
    return true;
  }
  if (slot.count >= perMinute) return false;
  slot.count++;
  return true;
}

module.exports = { findOrCreate, setLanguage, toggleSetting, incrementDownload, checkRateLimit };
