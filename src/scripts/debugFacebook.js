/**
 * Debug: fetch Facebook URL and report what the HTML body looks like.
 * Usage: node src/scripts/debugFacebook.js "<URL>"
 */
require('dotenv').config();
const axios = require('axios');

(async () => {
  const url = process.argv[2];
  if (!url) { console.error('Usage: node src/scripts/debugFacebook.js "<URL>"'); process.exit(1); }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (process.env.FACEBOOK_COOKIE) headers['Cookie'] = process.env.FACEBOOK_COOKIE;

  const r = await axios.get(url, { headers, timeout: 15000, maxRedirects: 5, validateStatus: () => true });
  const html = typeof r.data === 'string' ? r.data : '';
  const finalUrl = r.request?.res?.responseUrl || url;
  console.log('finalUrl:', finalUrl);
  console.log('status  :', r.status);
  console.log('length  :', html.length);
  console.log('hasCookie:', !!process.env.FACEBOOK_COOKIE);
  console.log('--- title-ish ---');
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  console.log('title   :', t ? t[1] : '(none)');
  const ogt = html.match(/og:title["'][^>]*content=["']([^"']+)/i);
  console.log('og:title:', ogt ? ogt[1] : '(none)');
  console.log('hasLogin:', /You must log in|login_factor|checkpoint/i.test(html));
  console.log('hasHDvar:', /browser_native_hd_url|playable_url|hd_src/i.test(html));
  console.log('hasMpd  :', /\.mpd|\.m3u8/.test(html));
  // Save full body to disk for inspection
  require('fs').writeFileSync('logs/fb-debug.html', html);
  console.log('Body saved to logs/fb-debug.html');
})().catch(e => { console.error('err:', e.message); process.exit(1); });
