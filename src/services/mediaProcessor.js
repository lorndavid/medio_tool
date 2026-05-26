const downloaders = require('./downloaders');
const MediaHistory = require('../models/MediaHistory');
const { incrementDownload } = require('./userService');
const analytics = require('./analyticsService');
const { t } = require('./i18n');
const logger = require('../utils/logger');
const fs = require('fs');

let botRef = null;
function setBot(bot) { botRef = bot; }

/**
 * Job data shape: { telegramId, chatId, statusMessageId, platform, url, lang, audioOnly, preferHD, userId }
 */
async function processMediaJob(job) {
  const { telegramId, chatId, statusMessageId, platform, url, lang, audioOnly, preferHD, userId } = job.data;
  if (!botRef) throw new Error('Bot not set in mediaProcessor');

  const startedAt = Date.now();
  const dl = downloaders[platform];
  if (!dl) {
    await safeEdit(chatId, statusMessageId, t('errors.invalidLink', {}, lang));
    return;
  }

  const history = await MediaHistory.create({
    user: userId,
    telegramId,
    platform,
    sourceUrl: url,
    status: 'processing',
    type: audioOnly ? 'audio' : 'video',
  });

  try {
    const result = await dl.fetch(url, { preferHD, audioOnly });

    if (result.status === 'success' && (result.videoUrl || result.audioUrl || result.localFile)) {
      await safeEdit(chatId, statusMessageId, t('sending', {}, lang));

      // Audio mode is YouTube-only. For any other platform, always send as video,
      // regardless of what the result/meta thinks.
      const isAudio = platform === 'youtube' && (result.type === 'audio' || result.meta?.kind === 'audio');

      const caption = buildCaption(platform, result.title, result.author, url);
      // TikTok captions use HTML for safer URL rendering. Everything else stays Markdown.
      const captionParseMode = platform === 'tiktok' ? 'HTML' : 'Markdown';

      // If we have a local file, send the stream/buffer (avoids Telegram fetching IP-bound URLs)
      const localFile = result.localFile;
      const sendSource = localFile ? fs.createReadStream(localFile) : (isAudio ? (result.audioUrl || result.videoUrl) : result.videoUrl);

      try {
        if (isAudio) {
          await botRef.sendChatAction(chatId, 'upload_voice').catch(() => {});
          await botRef.sendAudio(chatId, sendSource, {
            caption,
            parse_mode: captionParseMode,
            title: (result.title || '').slice(0, 64),
            performer: (result.author || '').slice(0, 64),
            duration: result.durationSec || 0,
            ...(result.thumbnail && !localFile ? { thumb: result.thumbnail } : {}),
          }, localFile ? { filename: `${(result.title || 'audio').replace(/[\/:*?"<>|]/g, '').slice(0, 60)}.${result.meta?.container || 'm4a'}`, contentType: result.meta?.mimeType || 'audio/mp4' } : undefined);
        } else {
          await botRef.sendChatAction(chatId, 'upload_video').catch(() => {});
          await botRef.sendVideo(chatId, sendSource, {
            caption,
            parse_mode: captionParseMode,
          });
        }
      } finally {
        if (localFile) {
          try { fs.unlinkSync(localFile); } catch (_) {}
        }
      }
      await botRef.deleteMessage(chatId, statusMessageId).catch(() => {});

      await MediaHistory.findByIdAndUpdate(history._id, {
        status: 'success',
        type: isAudio ? 'audio' : 'video',
        title: result.title,
        author: result.author,
        thumbnail: result.thumbnail,
        durationSec: result.durationSec,
        sizeMB: result.sizeMB,
        processingMs: Date.now() - startedAt,
      });
      await incrementDownload(telegramId);
      await analytics.track('download_success', { telegramId, platform, meta: { sizeMB: result.sizeMB, kind: isAudio ? 'audio' : 'video' } });
      return;
    }

    if (result.status === 'metadata') {
      const lines = [
        `📄 *${escapeMD(result.title || result.platform.toUpperCase())}*`,
        result.author ? `👤 ${escapeMD(result.author)}` : null,
        result.message ? `\n_${escapeMD(result.message)}_` : null,
        `\n🔗 ${result.sourceUrl || url}`,
      ].filter(Boolean).join('\n');

      if (result.thumbnail) {
        await botRef.sendPhoto(chatId, result.thumbnail, { caption: lines, parse_mode: 'Markdown' });
      } else {
        await safeEdit(chatId, statusMessageId, lines);
      }

      await MediaHistory.findByIdAndUpdate(history._id, {
        status: 'success',
        title: result.title,
        author: result.author,
        thumbnail: result.thumbnail,
        type: 'metadata',
        processingMs: Date.now() - startedAt,
      });
      await analytics.track('download_success', { telegramId, platform, meta: { mode: 'metadata' } });
      return;
    }

    // Error
    await safeEdit(chatId, statusMessageId, `❌ ${escapeMD(result.message || t('errors.generic', {}, lang))}`);
    await MediaHistory.findByIdAndUpdate(history._id, { status: 'failed', error: result.message });
    await analytics.track('download_failed', { telegramId, platform, meta: { reason: result.message } });
  } catch (err) {
    logger.error('mediaProcessor error', {
      err: err.message,
      stack: err.stack,
      platform,
      telegramId,
      url,
    });
    await MediaHistory.findByIdAndUpdate(history._id, { status: 'failed', error: err.message });
    await analytics.track('download_failed', { telegramId, platform, meta: { reason: err.message } });
    await safeEdit(chatId, statusMessageId, t('errors.generic', {}, lang));
  }
}

async function safeEdit(chatId, messageId, text) {
  try {
    await botRef.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
  } catch (_) {
    try { await botRef.sendMessage(chatId, text, { parse_mode: 'Markdown' }); } catch (_) {}
  }
}

function escapeMD(str = '') {
  return String(str).replace(/([_*`\[\]])/g, '\\$1');
}

/**
 * Build a Telegram-safe caption.
 * Telegram caption hard limit is 1024 characters. We aim for ~900 to leave headroom for
 * Markdown overhead. If the title is huge (Facebook descriptions), truncate it cleanly.
 *
 * Special case: TikTok shows the original link + bot username instead of title/author.
 */
const CAPTION_MAX = 900;
const TIKTOK_BOT_HANDLE = '@tiktokdavid_bot';

function buildCaption(platform, rawTitle, rawAuthor, sourceUrl) {
  if (platform === 'tiktok') {
    return buildTikTokCaption(sourceUrl);
  }

  const title = escapeMD((rawTitle || '').replace(/\s+/g, ' ').trim());
  const author = escapeMD((rawAuthor || '').replace(/\s+/g, ' ').trim());
  const authorLine = author ? `\n👤 ${author}` : '';
  const titleBudget = CAPTION_MAX - authorLine.length - 6; // 6 = "🎬 *…*"
  const trimmedTitle = title.length > titleBudget ? title.slice(0, titleBudget - 1).trimEnd() + '…' : title;
  let caption = `🎬 *${trimmedTitle}*${authorLine}`;
  if (caption.length > CAPTION_MAX) caption = caption.slice(0, CAPTION_MAX - 1) + '…';
  return caption;
}

function buildTikTokCaption(sourceUrl) {
  // Use HTML parse mode for TikTok — far more forgiving than Markdown for raw URLs
  // (which contain _, ?, =, & that the legacy Markdown parser treats as entity markers).
  const safeUrl = htmlEscape(sourceUrl || '');
  const link = sourceUrl ? `🔗 <a href="${safeUrl}">${safeUrl}</a>` : '';
  const handle = `🤖 ${TIKTOK_BOT_HANDLE}`;
  return [link, handle].filter(Boolean).join('\n');
}

function htmlEscape(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { processMediaJob, setBot };
