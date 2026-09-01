// Prints what the compressor's own planner produces for a typical phone
// recording (1080p30 with AAC audio) at a given target size, across a range
// of clip lengths — the source for every "how much video fits in N MB" table
// on the site. Figures come from buildPlan, not estimates, so the copy can't
// drift from what the tool actually does without this output changing too.
//
//   node --experimental-strip-types scripts/fit-table.mjs 10 25
import { buildPlan, maxFeasibleDurationS } from '../src/core/targetSize.ts';
import { FFMPEG_MIN_AUDIO_BPS } from '../src/engines/ffmpeg.ts';

const targets = process.argv.slice(2).map(Number);
if (targets.length === 0 || targets.some((n) => !(n > 0))) {
  console.error('usage: fit-table.mjs <targetMB> [<targetMB> ...]');
  process.exit(1);
}

const LENGTHS_S = [15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800];
const phone = (durationS) => ({
  container: 'mp4',
  durationS,
  video: { codec: 'avc', width: 1920, height: 1080, fps: 30, frameCount: 30 * durationS, bitrate: 12_000_000 },
  audio: { codec: 'aac', bitrate: 128_000 },
});
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

for (const mb of targets) {
  console.log(`\n=== ${mb} MB target — 1080p30 phone recording, 128k AAC ===`);
  console.log('length   output          fps  video kbps  audio kbps');
  for (const s of LENGTHS_S) {
    try {
      const p = buildPlan({ mode: 'target', targetMB: mb }, phone(s), undefined, FFMPEG_MIN_AUDIO_BPS);
      const a = p.audioBps === null ? 'copy' : String(Math.round(p.audioBps / 1000));
      console.log(
        `${clock(s).padEnd(8)} ${`${p.width}x${p.height}`.padEnd(15)} ${String(p.fps).padEnd(4)} ${String(Math.round(p.videoBps / 1000)).padEnd(11)} ${a}`,
      );
    } catch (e) {
      console.log(`${clock(s).padEnd(8)} refused (${e.code ?? e.message})`);
    }
  }
  const max = maxFeasibleDurationS(phone(3600), mb, FFMPEG_MIN_AUDIO_BPS);
  console.log(`ceiling: ${max === null ? 'none' : clock(max)} of 1080p30 fits at all`);
}
