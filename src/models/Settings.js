const { Schema, model } = require('mongoose');

/**
 * Single global settings document. Use SettingsModel.get() to fetch (or create) it.
 */
const SettingsSchema = new Schema(
  {
    _id: { type: String, default: 'global' },
    maintenance: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'We are doing maintenance. Please try again soon.' },
    defaultLanguage: { type: String, default: 'en' },
    enabledPlatforms: {
      tiktok: { type: Boolean, default: true },
      instagram: { type: Boolean, default: true },
      facebook: { type: Boolean, default: true },
      youtube: { type: Boolean, default: true },
    },
    rateLimits: {
      perUserPerMinute: { type: Number, default: 10 },
    },
    branding: {
      botName: { type: String, default: 'MediaFlow Bot' },
      supportUrl: { type: String, default: 'https://t.me/Tutuvid' },
    },
  },
  { timestamps: true, _id: false }
);

SettingsSchema.statics.get = async function get() {
  let doc = await this.findById('global');
  if (!doc) doc = await this.create({ _id: 'global' });
  return doc;
};

module.exports = model('Settings', SettingsSchema);
