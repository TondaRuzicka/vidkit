// Stages the ffmpeg.wasm single-thread core into public/ so it is served
// same-origin. Fetching it from a CDN would violate the privacy promise
// (a third-party request during the compress flow).
//
// The wasm core is ~31 MB raw, which exceeds Cloudflare Pages' 25 MiB per-file
// limit. We gzip it to ~9.7 MB on the way in; the runtime inflates it with
// DecompressionStream before handing it to the loader (see src/engines/ffmpeg.ts).
import { copyFile, mkdir, access, readFile, writeFile, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
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

// Loader glue is small (~109 KB) — copy as-is.
await copyFile(join(srcDir, 'ffmpeg-core.js'), join(destDir, 'ffmpeg-core.js'));
console.log('[copy-ffmpeg-core] copied ffmpeg-core.js');

// Gzip the wasm; never ship the raw 31 MB file (it would break the deploy).
// Stored with a neutral `.bin` extension on purpose: a `.gz` name makes static
// hosts (Vite preview, Cloudflare) add `Content-Encoding: gzip`, which would
// make the browser pre-inflate it and break our manual DecompressionStream
// decode. `.bin` is served as opaque bytes, so we always control the inflate.
const wasm = await readFile(join(srcDir, 'ffmpeg-core.wasm'));
const gz = gzipSync(wasm, { level: 9 });
await writeFile(join(destDir, 'ffmpeg-core.wasm.bin'), gz);
console.log(
  `[copy-ffmpeg-core] gzipped ffmpeg-core.wasm ${(wasm.length / 1048576).toFixed(1)}MB -> ${(gz.length / 1048576).toFixed(1)}MB`,
);

// Remove any stale copies from earlier builds so they can't slip into dist/.
await rm(join(destDir, 'ffmpeg-core.wasm'), { force: true });
await rm(join(destDir, 'ffmpeg-core.wasm.gz'), { force: true });
