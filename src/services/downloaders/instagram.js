/**
 * Instagram downloader (no API key required).
 *
 * Strategy:
 *   1. Parse the shortcode from /reel/<sc>/, /reels/<sc>/, /p/<sc>/, or /tv/<sc>/.
 *   2. Hit https://www.instagram.com/reel/<sc>/ with the FacebookExternalHit/Googlebot UA —
 *      this returns a static-friendly page with og:video / og:image / og:title
 *      AND the raw "video_url" / "video_versions" / "image_versions2" JSON keys.
 *   3. If that page lacks the video field (e.g. private), fall back to /reel/<sc>/embed/captioned/
 *      with the same bot UA — that endpoint exposes the video in a lighter HTML body.
 *   4. (Optional) Set INSTAGRAM_COOKIE in .env to access content gated behind login.
 *
 * Works for: public Reels, public Posts (videos), public IGTV.
 * Doesn't work for: private accounts, age-gated content, region-locked content (unless cookie set).
 */
const axios = require('axios');
const https = require('https');
const logger = require('../../utils/logger');

const PLATFORM = 'instagram';

// Bot UAs that get a stable, scraper-friendly page.
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

const VIDEO_PATTERNS = [
  /"video_url":"([^"]+)"/,           // primary key in IG GraphQL payload
  /"playable_url_quality_hd":"([^"]+)"/,
  /"playable_url":"([^"]+)"/,
  /"src":"([^"]+\.mp4[^"]*)"/,       // embed page
  /<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i,
  /<meta\s+property=["']og:video:secure_url["']\s+content=["']([^"']+)["']/i,
];

const VIDEO_VERSIONS_PATTERNS = [
  /"video_versions":\s*\[(.*?)\]/s,  // mobile/api shape
];

function decodeFbString(s) {
  if (!s) return s;
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

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

function extractShortcode(url) {
  // /reel/<sc>/, /reels/<sc>/, /p/<sc>/, /tv/<sc>/
  const m = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

function buildHeaders(ua) {
  const h = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (process.env.INSTAGRAM_COOKIE) h['Cookie'] = process.env.INSTAGRAM_COOKIE;
  return h;
}

async function getPage(url, ua) {
  try {
    const res = await client.get(url, { headers: buildHeaders(ua) });
    if (res.status !== 200 || typeof res.data !== 'string') return null;
    return res.data;
  } catch (e) {
    logger.warn('instagram getPage failed', { url, ua, err: e.message });
    return null;
  }
}

function findVideoUrl(html) {
  if (!html) return null;
  for (const re of VIDEO_PATTERNS) {
    const m = html.match(re);
    if (m && m[1] && /\.mp4/i.test(m[1])) {
      return decodeFbString(m[1]).replace(/&amp;/g, '&');
    }
  }
  // try video_versions array (api-shape)
  for (const re of VIDEO_VERSIONS_PATTERNS) {
    const m = html.match(re);
    if (m && m[1]) {
      const inner = m[1];
      // pick the highest width
      const all = [...inner.matchAll(/"width":\s*(\d+).*?"url":"([^"]+)"/gs)];
      if (all.length) {
        all.sort((a, b) => Number(b[1]) - Number(a[1]));
        return decodeFbString(all[0][2]).replace(/&amp;/g, '&');
      }
      const single = inner.match(/"url":"([^"]+)"/);
      if (single) return decodeFbString(single[1]).replace(/&amp;/g, '&');
    }
  }
  return null;
}

function extractMeta(html) {
  if (!html) return { title: '', thumbnail: '', author: '' };
  const get = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1]) : '';
  };
  const title = get(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const thumb = get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  // og:title looks like:  "Author Name on Instagram: \"caption...\""
  let author = '';
  const am = title.match(/^([^|]+?)\s+on\s+Instagram/i);
  if (am) author = am[1].trim();
  return { title, thumbnail: thumb, author };
}

async function tryWithUAs(url) {
  for (const ua of BOT_UAS) {
    const html = await getPage(url, ua);
    if (!html) continue;
    const videoUrl = findVideoUrl(html);
    const meta = extractMeta(html);
    if (videoUrl || meta.title || meta.thumbnail) {
      return { html, videoUrl, meta, ua };
    }
  }
  return null;
}

async function fetch(url) {
  try {
    const sc = extractShortcode(url);
    if (!sc) {
      return { platform: PLATFORM, status: 'error', message: 'Could not parse Instagram URL.' };
    }

    const canonical = `https://www.instagram.com/reel/${sc}/`;

    // Primary: canonical reel page (has full og: tags + video_url)
    let result = await tryWithUAs(canonical);

    let videoUrl = result?.videoUrl || null;
    let meta = result?.meta || { title: '', thumbnail: '', author: '' };

    // Secondary: lighter embed page if main page didn't yield a video
    if (!videoUrl) {
      const embed = `https://www.instagram.com/reel/${sc}/embed/captioned/`;
      const embedRes = await tryWithUAs(embed);
      if (embedRes) {
        videoUrl = videoUrl || embedRes.videoUrl;
        if (!meta.thumbnail) meta = { ...meta, thumbnail: embedRes.meta.thumbnail || meta.thumbnail };
      }
    }

    // Tertiary: /p/<sc>/ form (some posts return reel URLs as /p/)
    if (!videoUrl) {
      const post = `https://www.instagram.com/p/${sc}/`;
      const pr = await tryWithUAs(post);
      if (pr) {
        videoUrl = videoUrl || pr.videoUrl;
        if (!meta.title) meta = { ...meta, title: pr.meta.title };
        if (!meta.thumbnail) meta = { ...meta, thumbnail: pr.meta.thumbnail };
        if (!meta.author) meta = { ...meta, author: pr.meta.author };
      }
    }

    if (!videoUrl) {
      const isPrivate =
        result?.html && /(?:loginRedirectReason|require_login|not_authorized)/i.test(result.html);
      const reason = isPrivate
        ? 'This Instagram post requires login. Set INSTAGRAM_COOKIE in .env or share a public link.'
        : 'Could not extract a video from this Instagram post. It may be private, image-only, or removed.';
      return { platform: PLATFORM, status: 'error', message: reason, sourceUrl: canonical };
    }

    return {
      platform: PLATFORM,
      status: 'success',
      videoUrl,
      thumbnail: meta.thumbnail || null,
      title: meta.title || 'Instagram Reel',
      author: meta.author || '',
      sourceUrl: canonical,
    };
  } catch (err) {
    logger.error('instagram fetch failed', { err: err.message });
    return { platform: PLATFORM, status: 'error', message: `Instagram download failed: ${err.message}` };
  }
}

module.exports = { fetch, platform: PLATFORM };
