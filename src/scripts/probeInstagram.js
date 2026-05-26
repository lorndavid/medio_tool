const axios = require('axios');

(async () => {
  const sc = process.argv[2] || 'DV1EjFMDbgD';
  const urls = [
    `https://www.instagram.com/reel/${sc}/`,
    `https://www.instagram.com/reel/${sc}/embed/`,
    `https://www.instagram.com/reel/${sc}/embed/captioned/`,
    `https://www.instagram.com/p/${sc}/embed/captioned/`,
    `https://www.instagram.com/p/${sc}/`,
  ];
  const uas = [
    ['chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'],
    ['fbbot', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['twitterbot', 'Mozilla/5.0 (compatible; Twitterbot/1.0)'],
    ['ig-android', 'Instagram 219.0.0.12.117 Android (30/11; 480dpi; 1080x2206; OnePlus; ONEPLUS A6010; OnePlus6T; qcom; en_US; 346138365)'],
  ];
  for (const u of urls) {
    for (const [name, ua] of uas) {
      try {
        const r = await axios.get(u, {
          headers: { 'User-Agent': ua, Accept: 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.9' },
          timeout: 12000,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        const h = typeof r.data === 'string' ? r.data : '';
        const hasVid = /video_url|video_versions|playable_url|\.mp4/i.test(h);
        const hasOG = /og:video|og:image/i.test(h);
        console.log(
          String(r.status).padEnd(3),
          'len', String(h.length).padStart(7),
          'vid:', hasVid ? 'Y' : '.',
          'og:', hasOG ? 'Y' : '.',
          ' ', u.replace('https://www.instagram.com', '').padEnd(30),
          name
        );
      } catch (e) {
        console.log('ERR', e.code || e.message, u.replace('https://www.instagram.com', ''), name);
      }
    }
  }
})();
