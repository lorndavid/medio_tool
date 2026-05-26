const { Innertube } = require('youtubei.js');

(async () => {
  const url = process.argv[2] || 'https://youtu.be/uVsy7Q7qr8s';
  const idMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  const id = idMatch ? idMatch[1] : null;
  if (!id) {
    console.error('Could not parse video ID from:', url);
    process.exit(1);
  }
  console.log('Video ID:', id);

  // Try multiple client backends — IOS / ANDROID typically bypass PoToken checks.
  const clients = ['IOS', 'ANDROID', 'WEB', 'TV'];
  for (const c of clients) {
    try {
      const yt = await Innertube.create({ client_type: c, generate_session_locally: true });
      const info = await yt.getBasicInfo(id, c);
      const formats = info.streaming_data?.adaptive_formats || [];
      const audio = formats.filter((f) => f.has_audio && !f.has_video);
      const sample = audio[0];
      console.log(
        c.padEnd(8),
        '-> formats:', String(formats.length).padStart(2),
        ' audio-only:', String(audio.length).padStart(2),
        sample
          ? `(best: ${sample.mime_type?.split(';')[0] || '?'} ${Math.round((sample.bitrate || 0) / 1000)}kbps url=${sample.url ? 'YES' : 'NO'} decUrl=${sample.decipher ? 'fn' : '-'})`
          : ''
      );
    } catch (e) {
      console.log(c.padEnd(8), '-> ERR', e.message.slice(0, 120));
    }
  }
})();
