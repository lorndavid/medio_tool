/**
 * Write/replace MONGO_URI in .env directly from the command line.
 * Bypasses the editor so you don't have to remember Ctrl+S.
 *
 * Usage:
 *   node src/scripts/setMongo.js "mongodb+srv://user:encodedPass@host/db?..."
 *
 * Or via npm script:
 *   npm run set:mongo -- "mongodb+srv://user:encodedPass@host/db?..."
 */
const fs = require('fs');
const path = require('path');

const uri = process.argv[2];
if (!uri) {
  console.error('❌ Usage: node src/scripts/setMongo.js "<MONGO_URI>"');
  process.exit(1);
}

if (uri.includes('xxxxx') || uri.includes('USER:PASS')) {
  console.error('❌ That URI is still the example placeholder. Paste the real one from MongoDB Atlas → Connect → Drivers.');
  process.exit(1);
}

if (!/^mongodb(\+srv)?:\/\/[^@]+@[^/]+/.test(uri)) {
  console.error('❌ URI shape looks wrong. It must start with mongodb+srv:// or mongodb:// and include user:password@host.');
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env');
let body = '';
if (fs.existsSync(envPath)) body = fs.readFileSync(envPath, 'utf8');

const line = `MONGO_URI=${uri}`;
if (/^MONGO_URI=.*$/m.test(body)) {
  body = body.replace(/^MONGO_URI=.*$/m, line);
} else {
  body += (body.endsWith('\n') ? '' : '\n') + line + '\n';
}

fs.writeFileSync(envPath, body, 'utf8');

const masked = uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
console.log('✅ MONGO_URI written to .env');
console.log('   →', masked);
console.log('\nNow run:');
console.log('   npm run test:mongo');
