/**
 * Smoke test: YouTube downloader (metadata + audio).
 * Usage: node src/scripts/testYouTube.js "<URL>"
 */
require('dotenv').config();
const yt = require('../services/downloaders/youtube');

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node src/scripts/testYouTube.js "<URL>"');
    process.exit(1);
  }

  console.log('\n--- METADATA ---');
  const meta = await yt.fetch(url);
  console.log(JSON.stringify(meta, null, 2));

  console.log('\n--- AUDIO ---');
  const audio = await yt.fetch(url, { audioOnly: true });
  const safe = { ...audio };
  if (safe.audioUrl) safe.audioUrl = safe.audioUrl.slice(0, 100) + '...';
  if (safe.videoUrl) safe.videoUrl = safe.videoUrl.slice(0, 100) + '...';
  if (safe.thumbnail) safe.thumbnail = safe.thumbnail.slice(0, 100) + '...';
  console.log(JSON.stringify(safe, null, 2));
})();
