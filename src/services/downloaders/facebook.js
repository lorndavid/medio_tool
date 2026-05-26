/**
 * Facebook downloader (no API key required).
 *
 * Strategy:
 *   1. Resolve short URLs (/share/r/, /share/v/, fb.watch/) to canonical /reel/ or /watch?v= URL.
 *   2. Hit Facebook's plugins/video.php?href=<URL> as the FacebookExternalHit bot — this
 *      endpoint serves a static page with embedded HD/SD video URLs and survives most public posts.
 *   3. As a fallback, also fetch the canonical URL with the same bot UA to extract og:title / og:image.
 *   4. (Optional) Use FACEBOOK_COOKIE env var to access content gated behind a login wall.
 *
 * Works for: public Reels, public videos, /share/r/* shares, fb.watch/*.
 * Does not work for: private/friends-only, region-locked, or age-gated posts (returns a clear error).
 */
const axios = require('axios');
const https = require('https');
const logger = require('../../utils/logger');

const PLATFORM = 'facebook';

// Bot UAs used by FB's own scrapers — they get a stable, static-friendly page.
const BOT_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; Twitterbot/1.0)',
];

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32, timeout: 30000 });
const client = axios.create({
  httpsAgent,
  timeout: 15000,
  maxRedirects: 5,
  validateStatus: (s) => s < 500,
});

const HD_PATTERNS = [
  /"browser_native_hd_url":"([^"]+)"/,
  /"playable_url_quality_hd":"([^"]+)"/,
  /"hd_src_no_ratelimit":"([^"]+)"/,
  /"hd_src":"([^"]+)"/,
];
const SD_PATTERNS = [
  /"browser_native_sd_url":"([^"]+)"/,
  /"playable_url":"([^"]+)"/,
  /"sd_src_no_ratelimit":"([^"]+)"/,
  /"sd_src":"([^"]+)"/,
  /"video_redirect":"([^"]+)"/,
  /<source[^>]+src="(https?:[^"]+\.mp4[^"]*)"/i,
];

function decodeFbString(s) {
  if (!s) return s;
  // FB JSON escaping: \/, \u002F, \u0025, \u0026, \u003D, \\
  try {
    return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
  } catch {
    return s
      .replace(/\\\//g, '/')
      .replace(/\\u002F/gi, '/')
      .replace(/\\u0025/gi, '%')
      .replace(/\\u0026/gi, '&')
      .replace(/\\u003D/gi, '=')
      .replace(/\\\\/g, '\\');
  }
}

function buildHeaders(ua) {
  const h = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (process.env.FACEBOOK_COOKIE) h['Cookie'] = process.env.FACEBOOK_COOKIE;
  return h;
}

async function fetchHtml(url, ua) {
  const res = await client.get(url, { headers: buildHeaders(ua) });
  if (typeof res.data !== 'string') return { html: '', status: res.status };
  return { html: res.data, status: res.status };
}

function extractFirst(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeFbString(m[1]);
  }
  return null;
}

function extractMeta(html) {
  const decodeEntities = (s) =>
    (s || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
  const get = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1]) : '';
  };
  return {
    title: get(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i),
    thumbnail: get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i),
    description: get(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i),
  };
}

async function resolveCanonical(url) {
  // /share/r/, /share/v/, /share/p/, fb.watch/
  if (!/(?:facebook\.com\/share\/[a-z]\/|^https?:\/\/fb\.watch\/)/i.test(url)) return url;

  try {
    const res = await client.get(url, {
      headers: buildHeaders(BOT_UAS[0]),
      maxRedirects: 0,
      validateStatus: () => true,
    });
    const loc = res.headers.location;
    if (loc) {
      const next = loc.startsWith('http') ? loc : `https://www.facebook.com${loc}`;
      logger.info('facebook share resolved', { from: url, to: next });
      return next;
    }
    if (res.request?.res?.responseUrl) return res.request.res.responseUrl;
  } catch (e) {
    logger.warn('facebook resolveCanonical failed', { err: e.message });
  }
  return url;
}

function pluginsUrl(canonical) {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=false`;
}

async function tryWithUAs(url, patterns) {
  for (const ua of BOT_UAS) {
    try {
      const { html, status } = await fetchHtml(url, ua);
      if (status !== 200 || !html) continue;
      const hd = patterns.hd ? extractFirst(html, HD_PATTERNS) : null;
      const sd = patterns.sd ? extractFirst(html, SD_PATTERNS) : null;
      const meta = patterns.meta ? extractMeta(html) : { title: '', thumbnail: '' };
      if (hd || sd || meta.title || meta.thumbnail) {
        return { html, hd, sd, meta, ua, status };
      }
    } catch (e) {
      logger.warn('facebook tryWithUAs error', { url, ua, err: e.message });
    }
  }
  return null;
}

async function fetch(url) {
  try {
    const canonical = await resolveCanonical(url);

    // 1. Try plugins/video.php — gives us hd/sd video links
    const plugin = await tryWithUAs(pluginsUrl(canonical), { hd: true, sd: true });
    let videoUrl = null;
    let isHd = false;
    if (plugin) {
      videoUrl = plugin.hd || plugin.sd;
      isHd = !!plugin.hd;
    }

    // 2. Hit canonical URL for og:title + og:image (description = title fallback)
    const ogResult = await tryWithUAs(canonical, { meta: true, hd: true, sd: true });
    const meta = ogResult ? ogResult.meta : { title: '', thumbnail: '' };
    if (!videoUrl && ogResult) {
      videoUrl = ogResult.hd || ogResult.sd;
      isHd = !!ogResult.hd;
    }

    if (!videoUrl) {
      const looksGated =
        ogResult?.html &&
        /(login|checkpoint|content_unavailable|This content isn't available)/i.test(ogResult.html);
      const reason = looksGated
        ? 'This Facebook post requires login or is restricted. Set FACEBOOK_COOKIE in .env or share a public link.'
        : 'Could not extract a video URL from this Facebook post. It may be private, region-locked, or removed.';
      return { platform: PLATFORM, status: 'error', message: reason, sourceUrl: canonical };
    }

    return {
      platform: PLATFORM,
      status: 'success',
      videoUrl,
      thumbnail: meta.thumbnail || null,
      title: meta.title || meta.description || 'Facebook video',
      author: '',
      sourceUrl: canonical,
      meta: { quality: isHd ? 'hd' : 'sd' },
    };
  } catch (err) {
    logger.error('facebook fetch failed', { err: err.message });
    return { platform: PLATFORM, status: 'error', message: `Facebook download failed: ${err.message}` };
  }
}

module.exports = { fetch, platform: PLATFORM };
