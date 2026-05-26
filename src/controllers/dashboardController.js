const os = require('os');
const User = require('../models/User');
const MediaHistory = require('../models/MediaHistory');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const SupportTicket = require('../models/SupportTicket');
const Settings = require('../models/Settings');
const Broadcast = require('../models/Broadcast');
const Admin = require('../models/Admin');
const Log = require('../models/Log');
const { mongoose } = require('../config/db');

function uptime() { return Math.round(process.uptime()); }
function memUsage() {
  const m = process.memoryUsage();
  return {
    rssMB: +(m.rss / 1048576).toFixed(1),
    heapUsedMB: +(m.heapUsed / 1048576).toFixed(1),
    heapTotalMB: +(m.heapTotal / 1048576).toFixed(1),
    systemFreeMB: +(os.freemem() / 1048576).toFixed(1),
    systemTotalMB: +(os.totalmem() / 1048576).toFixed(1),
  };
}

async function overview(req, res) {
  const dayAgo = new Date(Date.now() - 86400000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [totalUsers, dailyUsers, downloads, dailyDownloads, openTickets, chartRaw, latestUsers, topLang, topCountries] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastActive: { $gte: dayAgo } }),
    MediaHistory.countDocuments({ status: 'success' }),
    MediaHistory.countDocuments({ status: 'success', createdAt: { $gte: dayAgo } }),
    SupportTicket.countDocuments({ status: { $in: ['open', 'pending'] } }),
    MediaHistory.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: 'success' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.find().sort({ createdAt: -1 }).limit(8).lean(),
    User.aggregate([{ $group: { _id: '$languageCode', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    User.aggregate([{ $match: { countryCode: { $ne: null } } }, { $group: { _id: '$countryCode', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
  ]);

  res.render('admin/overview', {
    page: 'overview',
    adminName: req.adminName,
    stats: { totalUsers, dailyUsers, downloads, dailyDownloads, openTickets },
    chart: { labels: chartRaw.map((d) => d._id), values: chartRaw.map((d) => d.count) },
    latestUsers,
    topLang,
    topCountries,
    sys: { uptime: uptime(), mem: memUsage(), loadavg: os.loadavg() },
  });
}

async function users(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const q = (req.query.q || '').trim();
  const filter = {};
  if (q) {
    if (/^\d+$/.test(q)) filter.telegramId = Number(q);
    else filter.$or = [
      { username: new RegExp(q, 'i') },
      { firstName: new RegExp(q, 'i') },
      { lastName: new RegExp(q, 'i') },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.render('admin/users', { page: 'users', adminName: req.adminName, items, total, q, currentPage: page, totalPages: Math.ceil(total / limit) });
}

async function analyticsPage(req, res) {
  const days = 14;
  const since = new Date(Date.now() - days * 86400000);
  const [byDay, byPlatform, byType] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    MediaHistory.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEvent.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);
  res.render('admin/analytics', {
    page: 'analytics', adminName: req.adminName,
    byDay: { labels: byDay.map((d) => d._id), values: byDay.map((d) => d.count) },
    byPlatform: { labels: byPlatform.map((d) => d._id), values: byPlatform.map((d) => d.count) },
    byType,
  });
}

async function mediaActivity(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 25;
  const items = await MediaHistory.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const total = await MediaHistory.estimatedDocumentCount();
  res.render('admin/media', { page: 'media', adminName: req.adminName, items, currentPage: page, totalPages: Math.ceil(total / limit) });
}

async function logsPage(req, res) {
  const items = await Log.find().sort({ createdAt: -1 }).limit(200).lean();
  res.render('admin/logs', { page: 'logs', adminName: req.adminName, items });
}

async function settingsPage(req, res) {
  const settings = await Settings.get();
  res.render('admin/settings', { page: 'settings', adminName: req.adminName, settings });
}

async function settingsUpdate(req, res) {
  const settings = await Settings.get();
  settings.maintenance = req.body.maintenance === 'on';
  settings.maintenanceMessage = req.body.maintenanceMessage || settings.maintenanceMessage;
  settings.defaultLanguage = req.body.defaultLanguage || settings.defaultLanguage;
  settings.enabledPlatforms = {
    tiktok: req.body['platforms.tiktok'] === 'on',
    instagram: req.body['platforms.instagram'] === 'on',
    facebook: req.body['platforms.facebook'] === 'on',
    youtube: req.body['platforms.youtube'] === 'on',
  };
  if (req.body.perUserPerMinute) settings.rateLimits.perUserPerMinute = Number(req.body.perUserPerMinute);
  await settings.save();
  res.redirect('/admin/settings');
}

async function broadcastPage(req, res) {
  const items = await Broadcast.find().sort({ createdAt: -1 }).limit(20).lean();
  res.render('admin/broadcast', { page: 'broadcast', adminName: req.adminName, items });
}

async function supportPage(req, res) {
  const items = await SupportTicket.find().sort({ updatedAt: -1 }).limit(50).lean();
  res.render('admin/support', { page: 'support', adminName: req.adminName, items });
}

async function languagesPage(req, res) {
  res.render('admin/languages', { page: 'languages', adminName: req.adminName });
}

async function performancePage(req, res) {
  res.render('admin/performance', {
    page: 'performance', adminName: req.adminName,
    sys: { uptime: uptime(), mem: memUsage(), loadavg: os.loadavg(), platform: os.platform(), node: process.version },
    db: { state: mongoose.connection.readyState },
  });
}

async function themesPage(req, res) {
  res.render('admin/themes', { page: 'themes', adminName: req.adminName });
}

async function apiSettingsPage(req, res) {
  res.render('admin/api', { page: 'api', adminName: req.adminName });
}

module.exports = {
  overview, users, analyticsPage, mediaActivity, logsPage,
  settingsPage, settingsUpdate, broadcastPage, supportPage,
  languagesPage, performancePage, themesPage, apiSettingsPage,
};
