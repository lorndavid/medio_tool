/**
 * Bootstraps the first admin user from .env values.
 * Run once: npm run seed:admin
 */
const env = require('../config/env');
const { connectDB, mongoose } = require('../config/db');
const Admin = require('../models/Admin');

(async () => {
  await connectDB();
  const exists = await Admin.findOne({ email: env.admin.email.toLowerCase() });
  if (exists) {
    console.log(`Admin already exists: ${exists.email}`);
    process.exit(0);
  }
  const passwordHash = await Admin.hashPassword(env.admin.password);
  const admin = await Admin.create({
    email: env.admin.email.toLowerCase(),
    name: env.admin.name,
    passwordHash,
    role: 'superadmin',
    permissions: { manageUsers: true, manageBroadcasts: true, manageSettings: true, manageAdmins: true, viewLogs: true },
  });
  console.log(`✅ Admin created: ${admin.email}`);
  await mongoose.disconnect();
  process.exit(0);
})();
