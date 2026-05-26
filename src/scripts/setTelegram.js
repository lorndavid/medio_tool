/**
 * Write/replace TELEGRAM_TOKEN in .env directly from the CLI (no editor needed).
 * Usage: node src/scripts/setTelegram.js "1234567890:AA..."
 *    or: npm run set:telegram -- "1234567890:AA..."
 */
const fs = require('fs');
const path = require('path');

const token = (process.argv[2] || '').trim();
if (!token) {
  console.error('❌ Usage: npm run set:telegram -- "<TELEGRAM_TOKEN>"');
  process.exit(1);
}

if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token)) {
  console.error('❌ That does not look like a valid Telegram token.');
  console.error('   Real tokens look like: 1234567890:AAGYC55PuCjDHxjfSHLfY1P2_Tsb7sKKHZ4');
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env');
let body = '';
if (fs.existsSync(envPath)) body = fs.readFileSync(envPath, 'utf8');

const line = `TELEGRAM_TOKEN=${token}`;
if (/^TELEGRAM_TOKEN=.*$/m.test(body)) {
  body = body.replace(/^TELEGRAM_TOKEN=.*$/m, line);
} else {
  body += (body.endsWith('\n') ? '' : '\n') + line + '\n';
}
fs.writeFileSync(envPath, body, 'utf8');

const masked = `${token.slice(0, 6)}...${token.slice(-4)}`;
console.log('✅ TELEGRAM_TOKEN written to .env');
console.log('   →', masked);
console.log('\nNow run:');
console.log('   npm run test:telegram');
