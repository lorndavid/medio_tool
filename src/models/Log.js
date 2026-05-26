const { Schema, model } = require('mongoose');

const LogSchema = new Schema(
  {
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info', index: true },
    source: { type: String, index: true },
    message: { type: String, required: true },
    meta: Schema.Types.Mixed,
  },
  { timestamps: true }
);

LogSchema.index({ createdAt: -1 });

module.exports = model('Log', LogSchema);
