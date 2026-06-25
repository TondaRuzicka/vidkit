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
        cv_cs: resolve(import.meta.dirname,'cs/compress-video/index.html'),
        cv25_cs: resolve(import.meta.dirname,'cs/compress-video-to-25mb/index.html'),
        cv10_cs: resolve(import.meta.dirname,'cs/compress-video-to-10mb/index.html'),
        cvwa_cs: resolve(import.meta.dirname,'cs/compress-video-for-whatsapp/index.html'),
      },
    },
  },
  // @ffmpeg packages probe for workers in ways esbuild prebundling breaks
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
});
