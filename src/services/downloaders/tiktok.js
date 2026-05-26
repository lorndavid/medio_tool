const axios = require('axios');
const https = require('https');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
];

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64, timeout: 30000 });
const client = axios.create({ httpsAgent, timeout: 12000 });

function pickUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLATFORM = 'tiktok';

/**
 * Fetch TikTok metadata + best playable URL.
 * Strategy: tikwm primary, with retry/backoff. Returns normalized payload.
 */
async function fetch(url, { preferHD = true } = {}) {
  const apiUrl = `${env.tikwmApi}?url=${encodeURIComponent(url)}&hd=${preferHD ? 1 : 0}`;
  let attempts = 0;
  const maxAttempts = 4;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await client.get(apiUrl, { headers: { 'User-Agent': pickUA() } });
      if (res.data && res.data.code === 0 && res.data.data) {
        const d = res.data.data;
        let videoUrl = d.hdplay || d.play;
        let sizeBytes = d.hdsize || d.size || 0;
        const sizeMB = +(sizeBytes / (1024 * 1024)).toFixed(2);

        // Telegram bot upload cap is 50MB. Auto-fallback to SD if over budget.
        if (sizeMB > 48 && d.play) videoUrl = d.play;

        return {
          platform: PLATFORM,
          status: 'success',
          videoUrl,
          audioUrl: d.music || null,
          thumbnail: d.cover,
          title: d.title || 'TikTok video',
          author: d.author?.nickname || d.author?.unique_id || 'TikTok user',
          durationSec: d.duration,
          sizeMB,
        };
      }
    } catch (err) {
      logger.warn('tiktok fetch attempt failed', { attempt: attempts, err: err.message });
    }
    await sleep(400 * attempts);
  }

  return { platform: PLATFORM, status: 'error', message: 'TikTok service is busy. Please try again.' };
}

module.exports = { fetch, platform: PLATFORM };
