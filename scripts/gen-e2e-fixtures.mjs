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
  // Legacy/broadcast containers behind the converter landing pages. Each uses
  // the codec pair you'd actually meet in the wild, not H.264 relabelled, so
  // the decoders those pages depend on are the ones under test.
  [join(dir, 'e2e-4s.wmv'), ['-i', BASE_4, '-c:v', 'wmv2', '-b:v', '800k', '-c:a', 'wmav2', '-b:a', '96k']],
  [join(dir, 'e2e-4s.flv'), ['-i', BASE_4, '-c:v', 'flv1', '-b:v', '800k', '-c:a', 'libmp3lame', '-ar', '44100', '-b:a', '96k']],
  [join(dir, 'e2e-4s.vob'), ['-i', BASE_4, '-f', 'vob', '-c:v', 'mpeg2video', '-b:v', '1500k', '-c:a', 'ac3', '-b:a', '128k']],
  [join(dir, 'e2e-4s.ts'), ['-i', BASE_4, '-c:v', 'libx264', '-b:v', '800k', '-c:a', 'aac', '-b:a', '96k', '-f', 'mpegts']],
  // 3GP only permits certain sizes/rates; H.263 rejects anything else outright.
  [join(dir, 'e2e-4s.3gp'), ['-i', BASE_4, '-c:v', 'h263', '-s', '352x288', '-r', '15', '-b:v', '400k', '-c:a', 'aac', '-ar', '8000', '-ac', '1', '-b:a', '24k']],
  [join(dir, 'e2e-4s.m4v'), ['-i', BASE_4, '-c:v', 'libx264', '-b:v', '800k', '-c:a', 'aac', '-b:a', '96k', '-f', 'mp4']],
  // Related extensions the FAQ copy on /ts-to-mp4/ and /3gp-to-mp4/ promises.
  [join(dir, 'e2e-4s.m2ts'), ['-i', BASE_4, '-c:v', 'libx264', '-b:v', '800k', '-c:a', 'ac3', '-b:a', '128k', '-f', 'mpegts']],
  [join(dir, 'e2e-4s.3g2'), ['-i', BASE_4, '-c:v', 'h263', '-s', '176x144', '-r', '15', '-b:v', '200k', '-c:a', 'aac', '-ar', '8000', '-ac', '1', '-b:a', '24k', '-f', '3g2']],
  // Long but tiny: at 240s a 2 MB target is infeasible (the audio floor alone
  // eats the budget), which exercises the targetTooSmall suggestion path.
  // Low res keeps generation and any follow-up encode fast.
  [join(dir, 'e2e-240s.mp4'), ['-f', 'lavfi', '-i', 'testsrc2=duration=240:size=320x180:rate=30',
             '-f', 'lavfi', '-i', 'sine=frequency=440:duration=240',
             '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', '500k', '-c:a', 'aac', '-b:a', '96k', '-shortest']],
];

for (const [out, args] of jobs) {
  if (existsSync(out)) continue;
  console.log('[fixtures] generating', out);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args, out], {
    stdio: 'inherit',
  });
}
console.log('[fixtures] ready in', dir);
