// Quick sanity-check that /admin/login renders without a 500.
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
  try {
    const res = await axios.get(`http://127.0.0.1:${port}/admin/login`, { validateStatus: () => true });
    console.log('GET /admin/login -> status', res.status);
    const cookies = res.headers['set-cookie'] || [];
    console.log('CSRF cookie set:', cookies.some((c) => c.includes('_csrf')));
    console.log('CSRF token field present:', /name="_csrf"/.test(res.data));
    if (res.status >= 500) {
      console.log('--- BODY (first 600 chars) ---');
      console.log(String(res.data).slice(0, 600));
    }
  } catch (e) {
    console.error('test error:', e.message);
  }
  srv.close();
  process.exit(0);
});
