/**
 * YouTube downloader powered by yt-dlp.
 *
 * Why yt-dlp:
 *   YouTube changes its player signature mechanics every 1–2 weeks, breaking pure-Node libraries
 *   like ytdl-core and youtubei.js. yt-dlp is the actively maintained gold standard with
 *   auto-fixes for every backend change, cookies, age-gate handling, and PoToken support.
 *
 * Why we download to disk instead of returning the URL directly:
 *   YouTube's googlevideo CDN URLs are IP-bound and return 403 when Telegram's servers try to
 *   fetch them from a different network. So we have yt-dlp save the file to a tempfile, then
 *   send the buffer/stream to Telegram. The mediaProcessor handles cleanup.
 *
 * Setup:
 *   • Local dev (Windows):  py -m pip install -U yt-dlp
 *   • Production (Ubuntu):  sudo apt install -y python3-pip && pip3 install -U --break-system-packages yt-dlp
 *   • Optional cookies:     YOUTUBE_COOKIES_FILE=/path/to/cookies.txt in .env
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const logger = require('../../utils/logger');

const PLATFORM = 'youtube';
const TELEGRAM_AUDIO_LIMIT_MB = 48;
const YT_TIMEOUT_MS = 90_000; // download can take a while on slow networks

const TMP_DIR = path.join(os.tmpdir(), 'mediaflow-yt');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

/**
 * yt-dlp invocation strategy:
 *   1. If YT_DLP_PATH env var is set → use it.
 *   2. Try `yt-dlp` from PATH.
 *   3. Fall back to `python -m yt_dlp` (works after `pip install yt-dlp`).
 */
function buildCandidates() {
  const candidates = [];
  if (process.env.YT_DLP_PATH) {
    candidates.push({ cmd: process.env.YT_DLP_PATH, args: [] });
  }
  candidates.push({ cmd: 'yt-dlp', args: [] });
  // Common Windows shim
  if (process.platform === 'win32') {
    candidates.push({ cmd: 'yt-dlp.exe', args: [] });
    candidates.push({ cmd: 'py', args: ['-m', 'yt_dlp'] });
  }
  candidates.push({ cmd: 'python3', args: ['-m', 'yt_dlp'] });
  candidates.push({ cmd: 'python', args: ['-m', 'yt_dlp'] });
  return candidates;
}

function runYtDlp(extraArgs) {
  const candidates = buildCandidates();
  return new Promise((resolve, reject) => {
    let attemptIdx = 0;

    const tryNext = () => {
      if (attemptIdx >= candidates.length) {
        return reject(
          new Error(
            'yt-dlp not found. Install it: `py -m pip install -U yt-dlp` (Windows) or `pip3 install -U yt-dlp` (Linux). Then restart the bot.'
          )
        );
      }
      const { cmd, args: prefix } = candidates[attemptIdx++];
      let stdout = '';
      let stderr = '';
      let resolved = false;
      let child;
      try {
        child = spawn(cmd, [...prefix, ...extraArgs], { windowsHide: true, shell: false });
      } catch (e) {
        return tryNext();
      }
      const settle = (fn, value) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(killer);
        fn(value);
      };
      child.on('error', (err) => {
        // ENOENT etc — try the next candidate
        if (err && (err.code === 'ENOENT' || /ENOENT|spawn/i.test(err.message))) {
          if (resolved) return;
          resolved = true;
          clearTimeout(killer);
          return tryNext();
        }
        settle(reject, err);
      });
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      const killer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (_) {}
        settle(reject, new Error(`yt-dlp timed out after ${YT_TIMEOUT_MS}ms`));
      }, YT_TIMEOUT_MS);

      child.on('close', (code) => {
        if (resolved) return;
        if (code === 0) return settle(resolve, { stdout, stderr });
        // Common: not found / wrong python — try next candidate
        if (/not recognized|not found|No module named/i.test(stderr) && attemptIdx < candidates.length) {
          resolved = true;
          clearTimeout(killer);
          return tryNext();
        }
        settle(reject, new Error(`yt-dlp failed (exit ${code}): ${stderr.trim().slice(-400) || 'no stderr'}`));
      });
    };

    tryNext();
  });
}

const VIDEO_ID_REGEX = /(?:v=|youtu\.be\/|shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/;
function parseVideoId(url) {
  const m = url.match(VIDEO_ID_REGEX);
  return m ? m[1] : null;
}

async function fetchMetadata(url) {
  try {
    const res = await axios.get(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { timeout: 8000 }
    );
    return {
      platform: PLATFORM,
      status: 'metadata',
      title: res.data.title,
      author: res.data.author_name,
      thumbnail: res.data.thumbnail_url,
      sourceUrl: url,
    };
  } catch (e) {
    logger.warn('youtube oembed failed', { err: e.message });
    return { platform: PLATFORM, status: 'error', message: 'Could not load YouTube metadata.' };
  }
}

async function fetchAudio(url) {
  if (!parseVideoId(url)) {
    return { platform: PLATFORM, status: 'error', message: 'Could not parse YouTube URL.' };
  }

  // Step 1: get metadata only (light call) so we can size-check before downloading
  const metaArgs = [
    '-j', '--no-warnings', '--no-playlist',
    '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
    '--no-check-certificates', '--retries', '2',
  ];
  if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
    metaArgs.push('--cookies', process.env.YOUTUBE_COOKIES_FILE);
  }
  metaArgs.push(url);

  let info;
  try {
    const { stdout } = await runYtDlp(metaArgs);
    info = JSON.parse(stdout);
  } catch (err) {
    logger.error('yt-dlp meta failed', { err: err.message });
    const m = err.message || '';
    if (/not found/i.test(m)) return { platform: PLATFORM, status: 'error', message: m };
    if (/Sign in|age|consent/i.test(m)) {
      return { platform: PLATFORM, status: 'error', message: 'YouTube requires sign-in. Set YOUTUBE_COOKIES_FILE in .env.' };
    }
    return { platform: PLATFORM, status: 'error', message: `YouTube extraction failed: ${m.slice(0, 200)}` };
  }

  if (info.is_live) return { platform: PLATFORM, status: 'error', message: 'Live streams cannot be downloaded.' };

  const sizeBytes = Number(info.filesize || info.filesize_approx || 0);
  const sizeMB = sizeBytes ? +(sizeBytes / 1048576).toFixed(2) : 0;
  if (sizeMB && sizeMB > TELEGRAM_AUDIO_LIMIT_MB) {
    return {
      platform: PLATFORM,
      status: 'error',
      message: `Audio is ${sizeMB} MB, larger than Telegram's 50 MB bot upload limit. Try a shorter video.`,
      title: info.title,
      thumbnail: info.thumbnail,
    };
  }

  // Step 2: download to a tempfile (Telegram cannot fetch googlevideo URLs from a different IP)
  const ext = info.ext || 'm4a';
  const localPath = path.join(TMP_DIR, `${crypto.randomBytes(6).toString('hex')}.${ext}`);
  const dlArgs = [
    '--no-warnings', '--no-playlist', '-q',
    '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
    '--no-check-certificates', '--retries', '2',
    '-o', localPath,
  ];
  if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
    dlArgs.push('--cookies', process.env.YOUTUBE_COOKIES_FILE);
  }
  dlArgs.push(url);

  try {
    await runYtDlp(dlArgs);
  } catch (err) {
    cleanup(localPath);
    logger.error('yt-dlp download failed', { err: err.message });
    return { platform: PLATFORM, status: 'error', message: `YouTube download failed: ${err.message.slice(0, 200)}` };
  }

  if (!fs.existsSync(localPath)) {
    return { platform: PLATFORM, status: 'error', message: 'yt-dlp finished but the file is missing.' };
  }

  const stat = fs.statSync(localPath);
  const finalMB = +(stat.size / 1048576).toFixed(2);
  if (finalMB > TELEGRAM_AUDIO_LIMIT_MB) {
    cleanup(localPath);
    return {
      platform: PLATFORM,
      status: 'error',
      message: `Audio is ${finalMB} MB, larger than Telegram's 50 MB bot upload limit.`,
    };
  }

  return {
    platform: PLATFORM,
    status: 'success',
    type: 'audio',
    localFile: localPath,            // mediaProcessor uploads buffer + cleans up after
    audioUrl: `file://${localPath}`, // marker only
    videoUrl: `file://${localPath}`,
    title: info.title || 'YouTube audio',
    author: info.uploader || info.channel || '',
    thumbnail: info.thumbnail || null,
    durationSec: Number(info.duration || 0),
    sizeMB: finalMB,
    sourceUrl: url,
    meta: {
      kind: 'audio',
      bitrate: info.abr ? Math.round(info.abr * 1000) : 0,
      container: info.ext,
      mimeType: info.audio_ext ? `audio/${info.audio_ext}` : `audio/${info.ext || 'mp4'}`,
    },
  };
}

function cleanup(p) {
  if (!p) return;
  try { fs.unlinkSync(p); } catch (_) {}
}

async function fetch(url, opts = {}) {
  if (opts.audioOnly) return fetchAudio(url);
  return fetchMetadata(url);
}

module.exports = { fetch, fetchMetadata, fetchAudio, platform: PLATFORM };
