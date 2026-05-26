const { Schema, model } = require('mongoose');

const AnalyticsEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'user_join',
        'command',
        'download_request',
        'download_success',
        'download_failed',
        'language_change',
        'broadcast_sent',
      ],
      required: true,
      index: true,
    },
    telegramId: { type: Number, index: true },
    platform: String,
    meta: Schema.Types.Mixed,
    countryCode: String,
    languageCode: String,
  },
  { timestamps: true }
);

AnalyticsEventSchema.index({ createdAt: -1 });
AnalyticsEventSchema.index({ type: 1, createdAt: -1 });

module.exports = model('AnalyticsEvent', AnalyticsEventSchema);
