/**
 * Diagnostic: validates TELEGRAM_TOKEN against Telegram's getMe endpoint.
 * Usage: node src/scripts/testTelegram.js
 */
require('dotenv').config();
const axios = require('axios');

(async () => {
  const raw = process.env.TELEGRAM_TOKEN || '';
  const token = raw.trim();
  console.log('--- Telegram token diagnostic ---');
  console.log('Raw length :', raw.length);
  console.log('Trimmed len:', token.length);
  if (raw !== token) console.log('⚠️  Token has surrounding whitespace — trim it!');

  // Mask: show first 6 and last 4 chars only
  const masked = token.length > 12 ? `${token.slice(0, 6)}...${token.slice(-4)}` : '(short or empty)';
  console.log('Token      :', masked);

  // Shape: <numeric_id>:<35-char_secret>
  const shapeOk = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token);
  console.log('Shape OK   :', shapeOk);
  if (!shapeOk) {
    console.log('\n❌ Token shape looks wrong. A real token looks like:');
    console.log('   1234567890:AAGYC55PuCjDHxjfSHLfY1P2_Tsb7sKKHZ4');
    console.log('   Did you copy the full string from @BotFather?');
    process.exit(1);
  }

  console.log('\nCalling https://api.telegram.org/bot<token>/getMe ...');
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 10000 });
    if (res.data?.ok) {
      const b = res.data.result;
      console.log('✅ Token works.');
      console.log('  Bot id        :', b.id);
      console.log('  Bot username  : @' + b.username);
      console.log('  Bot name      :', b.first_name);
      process.exit(0);
    }
    console.log('❌ Telegram responded but ok=false:', JSON.stringify(res.data));
    process.exit(1);
  } catch (e) {
    const status = e.response?.status;
    const body = e.response?.data;
    console.log('❌ Telegram API call failed.');
    console.log('  status :', status || '(no response — network issue)');
    if (body) console.log('  body   :', JSON.stringify(body));
    if (!status) console.log('  network:', e.code || e.message);

    if (status === 404 || status === 401) {
      console.log('\n→ Cause: Telegram does not recognize this token.');
      console.log('  Likely reasons:');
      console.log('   • The token is wrong / revoked');
      console.log('   • You only copied part of it (whitespace cut, missing the secret part)');
      console.log('   • You used the bot link/username instead of the token');
      console.log('   • The bot was deleted from @BotFather');
      console.log('\n  Fix:');
      console.log('   1. Open Telegram, message @BotFather');
      console.log('   2. /mybots → choose your bot → API Token');
      console.log('   3. Copy the FULL token (looks like 1234567890:AA...)');
      console.log('   4. Run:  npm run set:telegram -- "PASTE_TOKEN_HERE"');
      console.log('   5. Then: npm run test:telegram');
    }
    process.exit(1);
  }
})();
