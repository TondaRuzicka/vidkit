// Generates the small, deterministic fixtures the e2e suite needs.
// Idempotent: skips files that already exist. Requires the ffmpeg CLI.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'test-videos', 'e2e');
mkdirSync(dir, { recursive: true });

const BASE_10 = join(dir, 'e2e-10s.mp4');
const BASE_60 = join(dir, 'e2e-60s.mp4');
// formats that may route to single-threaded ffmpeg.wasm get a short base:
// 10s of 1080p through wasm x264 takes ~4 minutes in Firefox
const BASE_4 = join(dir, 'e2e-4s.mp4');

const jobs = [
  [BASE_10, ['-f', 'lavfi', '-i', 'testsrc2=duration=10:size=1920x1080:rate=30',
             '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
             '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', '8M', '-c:a', 'aac', '-b:a', '128k', '-shortest']],
  [BASE_60, ['-f', 'lavfi', '-i', 'testsrc2=duration=60:size=1920x1080:rate=30',
             '-f', 'lavfi', '-i', 'sine=frequency=440:duration=60',
             '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', '8M', '-c:a', 'aac', '-b:a', '128k', '-shortest']],
  [BASE_4, ['-f', 'lavfi', '-i', 'testsrc2=duration=4:size=1280x720:rate=30',
            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', '8M', '-c:a', 'aac', '-b:a', '128k', '-shortest']],
  [join(dir, 'e2e-4s.avi'), ['-i', BASE_4, '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'mp3']],
  [join(dir, 'e2e-4s.webm'), ['-i', BASE_4, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '4M', '-c:a', 'libopus']],
  [join(dir, 'e2e-h265-4s.mp4'), ['-i', BASE_4, '-c:v', 'libx265', '-tag:v', 'hvc1', '-preset', 'fast', '-b:v', '4M', '-c:a', 'copy']],
  [join(dir, 'e2e-10s.mkv'), ['-i', BASE_10, '-c', 'copy']],
  [join(dir, 'e2e-10s.mov'), ['-i', BASE_10, '-c', 'copy']],
  [join(dir, 'e2e-not-a-video.mp4'), ['-f', 'lavfi', '-i', 'color=red:size=64x64:duration=0.04', '-frames:v', '1', '-f', 'mjpeg']],
];

for (const [out, args] of jobs) {
  if (existsSync(out)) continue;
  console.log('[fixtures] generating', out);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args, out], {
    stdio: 'inherit',
  });
}
console.log('[fixtures] ready in', dir);
