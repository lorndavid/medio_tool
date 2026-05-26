/**
 * Diagnostic helper: tests MongoDB connection and prints rich error detail.
 * Usage: node src/scripts/testMongo.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns').promises;

(async () => {
  const uri = process.env.MONGO_URI || '';
  const masked = uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
  console.log('--- MongoDB connection diagnostic ---');
  console.log('URI       :', masked || '(empty)');
  console.log('SRV form  :', uri.startsWith('mongodb+srv://'));

  if (uri.includes('xxxxx') || uri.includes('USER:PASS')) {
    console.log('\n🛑 STOP. Your .env on disk still contains the example placeholder');
    console.log('         (xxxxx / USER:PASS). The real URI from your editor was never saved.');
    console.log('\n   Fix it without the editor — one command:');
    console.log('   npm run set:mongo -- "mongodb+srv://yourUser:yourEncodedPass@cluster0.ab1cd.mongodb.net/mediaflow?retryWrites=true&w=majority&appName=Cluster0"');
    console.log('\n   Then run: npm run test:mongo');
    process.exit(1);
  }

  // Look for /<dbName> after the host
  const dbMatch = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
  const dbName = dbMatch && dbMatch[1] ? dbMatch[1] : '';
  console.log('DB name   :', dbName ? `"${dbName}"` : '(none — defaults to "test")');

  // SRV DNS check
  if (uri.startsWith('mongodb+srv://')) {
    try {
      const host = uri.replace('mongodb+srv://', '').split('@').pop().split('/')[0].split('?')[0];
      console.log('SRV host  :', host);
      const srv = await dns.resolveSrv(`_mongodb._tcp.${host}`);
      console.log('SRV records found:', srv.length);
      srv.slice(0, 3).forEach((r) => console.log('  •', r.name, 'port', r.port));
    } catch (e) {
      console.log('❌ SRV DNS lookup FAILED:', e.code || e.message);
      console.log('   → Means your machine cannot resolve the cluster hostname (DNS, firewall, or wrong cluster URL).');
    }
  }

  console.log('\nAttempting mongoose.connect()...');
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 8000,
    });
    console.log('✅ Connected.');
    const db = mongoose.connection.db.databaseName;
    console.log('Connected to database:', db);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.log('❌ Connection FAILED');
    console.log('  message :', e.message);
    console.log('  name    :', e.name);
    console.log('  code    :', e.code);
    if (e.reason) {
      const r = e.reason;
      console.log('  reason  :', r.message || String(r));
      if (r.servers) {
        for (const [host, info] of r.servers.entries()) {
          console.log('  server  :', host, '→', info?.error?.message || info?.type || JSON.stringify(info));
        }
      }
    }
    console.log('\nCommon causes:');
    console.log('  • IP not in MongoDB Atlas Network Access allowlist (add your IP or 0.0.0.0/0 for dev)');
    console.log('  • Wrong username / password');
    console.log('  • Password contains special chars not URL-encoded (@ : / ? # & need %-encoding)');
    console.log('  • DB user has no role on the target database');
    console.log('  • Wrong cluster hostname / typo');
    console.log('  • Outbound TCP 27017 blocked by network/firewall (most ISPs are fine, some campus/office nets block it)');
    process.exit(1);
  }
})();
