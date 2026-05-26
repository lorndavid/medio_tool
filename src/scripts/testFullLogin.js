// Verifies the full login round-trip: GET form -> extract csrf -> POST with credentials.
process.env.TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '1:abcdefghijklmnopqrstuvwxyz0123456789ABC';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dummy';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'aaaaaaaaaaaaaaaa';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'bbbbbbbbbbbbbbbb';

const http = require('http');
const axios = require('axios');
const { createApp } = require('../app');

const app = createApp();
const srv = http.createServer(app).listen(0, async () => {
  const port = srv.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    // Step 1: GET login page
    const get = await axios.get(`${base}/admin/login`, { validateStatus: () => true });
    const setCookies = get.headers['set-cookie'] || [];
    const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    const tokenMatch = String(get.data).match(/name="_csrf" value="([^"]+)"/);
    const csrf = tokenMatch && tokenMatch[1];
    console.log('GET /admin/login ->', get.status, 'csrf-extracted:', !!csrf);

    // Step 2: POST with bogus credentials but the proper _csrf token
    const params = new URLSearchParams({
      _csrf: csrf || '',
      email: 'admin@mediaflow.local',
      password: 'wrong-password-on-purpose',
    });
    const post = await axios.post(`${base}/admin/login`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader },
      validateStatus: () => true,
      maxRedirects: 0,
    });
    console.log('POST /admin/login ->', post.status, '(401 = csrf accepted; will compare creds)');
    const errMatch = String(post.data).match(/<div[^>]*rose[^>]*>([^<]+)/);
    if (errMatch) console.log('Form error shown:', errMatch[1].trim());
  } catch (e) {
    console.error('test error:', e.message);
  }
  srv.close();
  process.exit(0);
});
