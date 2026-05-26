const { Schema, model } = require('mongoose');

const BroadcastSchema = new Schema(
  {
    title: String,
    body: { type: String, required: true },
    audience: {
      type: String,
      enum: ['all', 'active', 'language', 'country'],
      default: 'all',
    },
    audienceFilter: Schema.Types.Mixed, // e.g. { languageCode: 'km' } or { countryCode: 'KH' }
    sentBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    stats: {
      total: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['draft', 'sending', 'done', 'failed'], default: 'draft' },
  },
  { timestamps: true }
);

module.exports = model('Broadcast', BroadcastSchema);
