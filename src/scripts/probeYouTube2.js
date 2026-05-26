const { Innertube } = require('youtubei.js');

(async () => {
  const id = 'uVsy7Q7qr8s';
  for (const client of ['ANDROID', 'IOS', 'WEB']) {
    console.log('\n=== client:', client, '===');
    try {
      const yt = await Innertube.create({ generate_session_locally: true });
      const info = await yt.getBasicInfo(id, client);
      const sd = info.streaming_data;
      if (!sd) { console.log('no streaming_data'); continue; }
      console.log('adaptive_formats:', sd.adaptive_formats?.length || 0);
      console.log('formats:', sd.formats?.length || 0);
      const audio = (sd.adaptive_formats || []).filter(f => f.has_audio && !f.has_video);
      console.log('audio-only:', audio.length);
      if (audio[0]) {
        const f = audio[0];
        console.log('sample[0]:', {
          mime: f.mime_type,
          bitrate: f.bitrate,
          has_url: !!f.url,
          url_len: f.url ? f.url.length : 0,
          decipher: typeof f.decipher,
          itag: f.itag,
          content_length: f.content_length,
        });
      }
      // Try via getInfo (heavier — pulls full info object)
      try {
        const fullInfo = await yt.getInfo(id, client);
        const sd2 = fullInfo.streaming_data;
        const audio2 = (sd2?.adaptive_formats || []).filter(f => f.has_audio && !f.has_video);
        console.log('getInfo audio-only:', audio2.length);
        if (audio2[0]) {
          // Try chooseFormat / decipher
          let resolvedUrl = audio2[0].url;
          if (!resolvedUrl && typeof audio2[0].decipher === 'function') {
            try { resolvedUrl = audio2[0].decipher(yt.session.player); } catch (e) { console.log('decipher err:', e.message); }
          }
          console.log('getInfo resolved url present:', !!resolvedUrl);
        }
        // Try chooseFormat helper
        try {
          const f = fullInfo.chooseFormat({ type: 'audio', quality: 'best' });
          console.log('chooseFormat:', { has_url: !!f.url, mime: f.mime_type });
        } catch (e) { console.log('chooseFormat err:', e.message); }
      } catch (e) {
        console.log('getInfo err:', e.message);
      }
    } catch (e) {
      console.log('client failed:', e.message);
    }
  }
})();
