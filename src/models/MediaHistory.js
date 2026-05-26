const { Schema, model } = require('mongoose');

const MediaHistorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    telegramId: { type: Number, index: true },
    platform: {
      type: String,
      enum: ['tiktok', 'instagram', 'facebook', 'youtube', 'unknown'],
      index: true,
    },
    sourceUrl: { type: String, required: true },
    title: String,
    author: String,
    thumbnail: String,
    durationSec: Number,
    sizeMB: Number,
    type: { type: String, enum: ['video', 'audio', 'image', 'metadata'], default: 'video' },
    status: {
      type: String,
      enum: ['queued', 'processing', 'success', 'failed'],
      default: 'queued',
      index: true,
    },
    error: String,
    processingMs: Number,
  },
  { timestamps: true }
);

MediaHistorySchema.index({ createdAt: -1 });

module.exports = model('MediaHistory', MediaHistorySchema);
