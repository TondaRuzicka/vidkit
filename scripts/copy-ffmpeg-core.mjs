// Copies the ffmpeg.wasm single-thread core into public/ so it is served
// same-origin. Fetching it from a CDN would violate the privacy promise
// (a third-party request during the compress flow).
import { copyFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// esm flavor: @ffmpeg/ffmpeg's worker loads the core via dynamic import()
const srcDir = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const destDir = join(root, 'public', 'ffmpeg');

try {
  await access(srcDir);
} catch {
  console.log('[copy-ffmpeg-core] @ffmpeg/core not installed yet, skipping');
  process.exit(0);
}

await mkdir(destDir, { recursive: true });
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await copyFile(join(srcDir, f), join(destDir, f));
  console.log(`[copy-ffmpeg-core] copied ${f}`);
}
