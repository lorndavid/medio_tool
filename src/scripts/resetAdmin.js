/**
 * List existing admins and reset the one matching ADMIN_EMAIL to a known password.
 * Also removes any stale admins (other emails) so only one superadmin exists.
 *
 * Usage:
 *   npm run reset:admin              (uses ADMIN_EMAIL / ADMIN_PASSWORD from .env)
 *   npm run reset:admin -- newpass   (overrides the password)
 */
const env = require('../config/env');
const { connectDB, mongoose } = require('../config/db');
const Admin = require('../models/Admin');

(async () => {
  await connectDB();

  const all = await Admin.find().select('email name role isActive lastLoginAt createdAt').lean();
  console.log('--- existing admins ---');
  if (!all.length) console.log('(none)');
  for (const a of all) {
    console.log(
      ' •', a.email,
      '|', a.name,
      '|', a.role,
      '|', a.isActive ? 'active' : 'INACTIVE',
      '|', 'created', a.createdAt?.toISOString?.().slice(0, 10)
    );
  }

  const email = env.admin.email.toLowerCase();
  const newPassword = process.argv[2] || env.admin.password;

  // Remove any other admins so the desired one is canonical
  const stale = await Admin.deleteMany({ email: { $ne: email } });
  if (stale.deletedCount) console.log(`\n🧹 Removed ${stale.deletedCount} stale admin(s).`);

  let admin = await Admin.findOne({ email });
  if (!admin) {
    console.log(`\nNo admin found for ${email}. Creating one...`);
    admin = await Admin.create({
      email,
      name: env.admin.name,
      passwordHash: await Admin.hashPassword(newPassword),
      role: 'superadmin',
      permissions: { manageUsers: true, manageBroadcasts: true, manageSettings: true, manageAdmins: true, viewLogs: true },
    });
    console.log('✅ Created superadmin:', admin.email);
  } else {
    admin.passwordHash = await Admin.hashPassword(newPassword);
    admin.name = env.admin.name;
    admin.isActive = true;
    admin.role = 'superadmin';
    admin.permissions = { manageUsers: true, manageBroadcasts: true, manageSettings: true, manageAdmins: true, viewLogs: true };
    await admin.save();
    console.log(`\n✅ Updated ${admin.email} (password reset, role=superadmin).`);
  }

  console.log('\n--- LOGIN WITH ---');
  console.log('  Email   :', email);
  console.log('  Password:', newPassword);

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('error:', e.message);
  process.exit(1);
});
