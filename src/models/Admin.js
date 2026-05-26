const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'admin', 'support'], default: 'admin' },
    permissions: {
      manageUsers: { type: Boolean, default: true },
      manageBroadcasts: { type: Boolean, default: true },
      manageSettings: { type: Boolean, default: false },
      manageAdmins: { type: Boolean, default: false },
      viewLogs: { type: Boolean, default: true },
    },
    lastLoginAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AdminSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

AdminSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
};

module.exports = model('Admin', AdminSchema);
