/**
 * Quick smoke test for the Facebook downloader.
 * Usage:
 *   node src/scripts/testFacebook.js "https://www.facebook.com/reel/12345"
 */
require('dotenv').config();
const fb = require('../services/downloaders/facebook');

(async () => {
  const urls = process.argv.slice(2);
  if (!urls.length) {
    console.error('Usage: node src/scripts/testFacebook.js "<URL1>" "<URL2>" ...');
    process.exit(1);
  }
  for (const url of urls) {
    console.log('\n=== ' + url + ' ===');
    try {
      const r = await fb.fetch(url);
      const safe = { ...r };
      if (safe.videoUrl) safe.videoUrl = safe.videoUrl.slice(0, 100) + '...';
      if (safe.thumbnail) safe.thumbnail = safe.thumbnail.slice(0, 100) + '...';
      console.log(JSON.stringify(safe, null, 2));
    } catch (e) {
      console.log('throw:', e.message);
    }
  }
})();
