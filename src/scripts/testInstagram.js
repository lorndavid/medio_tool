/**
 * Smoke test for the Instagram downloader.
 * Usage: node src/scripts/testInstagram.js "<URL1>" "<URL2>" ...
 */
require('dotenv').config();
const ig = require('../services/downloaders/instagram');

(async () => {
  const urls = process.argv.slice(2);
  if (!urls.length) {
    console.error('Usage: node src/scripts/testInstagram.js "<URL>"');
    process.exit(1);
  }
  for (const url of urls) {
    console.log('\n=== ' + url + ' ===');
    const r = await ig.fetch(url);
    const safe = { ...r };
    if (safe.videoUrl) safe.videoUrl = safe.videoUrl.slice(0, 100) + '...';
    if (safe.thumbnail) safe.thumbnail = safe.thumbnail.slice(0, 100) + '...';
    console.log(JSON.stringify(safe, null, 2));
  }
})();
