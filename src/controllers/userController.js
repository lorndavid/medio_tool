const User = require('../models/User');

async function ban(req, res) {
  await User.updateOne({ _id: req.params.id }, { $set: { isBanned: true } });
  res.redirect('back');
}

async function unban(req, res) {
  await User.updateOne({ _id: req.params.id }, { $set: { isBanned: false } });
  res.redirect('back');
}

async function mute(req, res) {
  await User.updateOne({ _id: req.params.id }, { $set: { isMuted: true } });
  res.redirect('back');
}

async function unmute(req, res) {
  await User.updateOne({ _id: req.params.id }, { $set: { isMuted: false } });
  res.redirect('back');
}

async function exportCsv(req, res) {
  const users = await User.find().lean();
  const rows = [['telegramId', 'username', 'firstName', 'language', 'downloads', 'banned', 'createdAt']];
  for (const u of users) {
    rows.push([
      u.telegramId,
      u.username || '',
      (u.firstName || '').replace(/[\r\n,]/g, ' '),
      u.languageCode || '',
      u.downloads || 0,
      u.isBanned ? 'yes' : 'no',
      u.createdAt?.toISOString?.() || '',
    ]);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.send(rows.map((r) => r.join(',')).join('\n'));
}

module.exports = { ban, unban, mute, unmute, exportCsv };
