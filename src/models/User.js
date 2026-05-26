const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, index: true },
    firstName: String,
    lastName: String,
    languageCode: { type: String, default: 'en' }, // selected by user
    countryCode: { type: String, index: true },    // best-effort, from telegram if available
    isPremium: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false, index: true },
    isMuted: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'vip', 'admin'], default: 'user' },
    downloads: { type: Number, default: 0, index: true },
    lastActive: { type: Date, default: Date.now, index: true },
    settings: {
      preferHD: { type: Boolean, default: true },
      audioOnly: { type: Boolean, default: false },
      notify: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

UserSchema.index({ createdAt: -1 });

module.exports = model('User', UserSchema);
