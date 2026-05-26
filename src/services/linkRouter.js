/**
 * Detects the platform of a given URL.
 */

const PATTERNS = [
  { platform: 'tiktok', regex: /(^|\W)(https?:\/\/[^\s]*tiktok\.com[^\s]*)/i },
  { platform: 'tiktok', regex: /(^|\W)(https?:\/\/(?:vt|vm)\.tiktok\.com[^\s]*)/i },
  { platform: 'instagram', regex: /(^|\W)(https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[^\s]+)/i },
  { platform: 'facebook', regex: /(^|\W)(https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/[^\s]+)/i },
  { platform: 'facebook', regex: /(^|\W)(https?:\/\/fb\.watch\/[^\s]+)/i },
  { platform: 'youtube', regex: /(^|\W)(https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s]+)/i },
];

function detect(text) {
  if (!text) return null;
  for (const { platform, regex } of PATTERNS) {
    const m = text.match(regex);
    if (m) return { platform, url: m[2] };
  }
  return null;
}

module.exports = { detect };
