const { Schema, model } = require('mongoose');

const MessageSchema = new Schema(
  {
    from: { type: String, enum: ['user', 'admin'], required: true },
    body: { type: String, required: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema(
  {
    telegramId: { type: Number, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    subject: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'pending', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

SupportTicketSchema.index({ createdAt: -1 });

module.exports = model('SupportTicket', SupportTicketSchema);
