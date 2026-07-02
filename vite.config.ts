import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import pages from './vite-plugin-pages';

export default defineConfig({
  plugins: [pages()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname,'index.html'),
        home_cs: resolve(import.meta.dirname,'cs/index.html'),
        cv: resolve(import.meta.dirname,'compress-video/index.html'),
        cv25: resolve(import.meta.dirname,'compress-video-to-25mb/index.html'),
        cv10: resolve(import.meta.dirname,'compress-video-to-10mb/index.html'),
        cvwa: resolve(import.meta.dirname,'compress-video-for-whatsapp/index.html'),
        cv_cs: resolve(import.meta.dirname,'cs/zmensit-video/index.html'),
        cv25_cs: resolve(import.meta.dirname,'cs/zmensit-video-na-25-mb/index.html'),
        cv10_cs: resolve(import.meta.dirname,'cs/zmensit-video-na-10-mb/index.html'),
        cvwa_cs: resolve(import.meta.dirname,'cs/zmensit-video-pro-whatsapp/index.html'),
        // Conversion landing pages (en + cs)
        mov2mp4: resolve(import.meta.dirname,'mov-to-mp4/index.html'),
        webm2mp4: resolve(import.meta.dirname,'webm-to-mp4/index.html'),
        mkv2mp4: resolve(import.meta.dirname,'mkv-to-mp4/index.html'),
        avi2mp4: resolve(import.meta.dirname,'avi-to-mp4/index.html'),
        mp42webm: resolve(import.meta.dirname,'mp4-to-webm/index.html'),
        mp42mp3: resolve(import.meta.dirname,'mp4-to-mp3/index.html'),
        mp42gif: resolve(import.meta.dirname,'mp4-to-gif/index.html'),
        mov2mp4_cs: resolve(import.meta.dirname,'cs/mov-na-mp4/index.html'),
        webm2mp4_cs: resolve(import.meta.dirname,'cs/webm-na-mp4/index.html'),
        mkv2mp4_cs: resolve(import.meta.dirname,'cs/mkv-na-mp4/index.html'),
        avi2mp4_cs: resolve(import.meta.dirname,'cs/avi-na-mp4/index.html'),
        mp42webm_cs: resolve(import.meta.dirname,'cs/mp4-na-webm/index.html'),
        mp42mp3_cs: resolve(import.meta.dirname,'cs/mp4-na-mp3/index.html'),
        mp42gif_cs: resolve(import.meta.dirname,'cs/mp4-na-gif/index.html'),
        // Audio-extraction cluster (English-only)
        mov2mp3: resolve(import.meta.dirname,'mov-to-mp3/index.html'),
        m4a2mp3: resolve(import.meta.dirname,'m4a-to-mp3/index.html'),
        wav2mp3: resolve(import.meta.dirname,'wav-to-mp3/index.html'),
        mkv2mp3: resolve(import.meta.dirname,'mkv-to-mp3/index.html'),
        webm2mp3: resolve(import.meta.dirname,'webm-to-mp3/index.html'),
        video2mp3: resolve(import.meta.dirname,'video-to-mp3/index.html'),
        extractaudio: resolve(import.meta.dirname,'extract-audio-from-video/index.html'),
        // Reference content (English-only)
        limits: resolve(import.meta.dirname,'video-upload-size-limits/index.html'),
      },
    },
  },
  // @ffmpeg packages probe for workers in ways esbuild prebundling breaks
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
});
