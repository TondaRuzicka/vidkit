import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompressError, type ProbeResult } from './types.ts';
import {
  buildPlan,
  fitToLongEdge,
  pickLadderRung,
  retryVideoBps,
} from './targetSize.ts';

const probe = (over: {
  durationS: number;
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: number;
  audio?: ProbeResult['audio'];
}): ProbeResult => ({
  container: 'mp4',
  durationS: over.durationS,
  video: {
    codec: 'avc',
    width: over.width ?? 1920,
    height: over.height ?? 1080,
    fps: over.fps ?? 30,
    frameCount: Math.round((over.fps ?? 30) * over.durationS),
    bitrate: over.videoBitrate ?? 8_000_000,
  },
  audio:
    over.audio === undefined
      ? { codec: 'aac', bitrate: 128_000 }
      : over.audio,
});

test('fitToLongEdge preserves aspect and rounds to even', () => {
  // height rounds DOWN to even (405 -> 404): never exceeds the ideal scale
  assert.deepEqual(fitToLongEdge(1920, 1080, 720), { width: 720, height: 404 });
  assert.deepEqual(fitToLongEdge(1080, 1920, 720), { width: 404, height: 720 });
  // never upscales
  assert.deepEqual(fitToLongEdge(640, 360, 1080), { width: 640, height: 360 });
});

test('short clip at 25MB keeps source resolution', () => {
  const plan = buildPlan({ mode: 'target', targetMB: 25 }, probe({ durationS: 30 }));
  assert.equal(plan.width, 1920);
  assert.equal(plan.height, 1080);
  // ~6.2 Mbps video — plenty above min bpp at 1080p30
  assert.ok(plan.videoBps > 5_000_000, `videoBps=${plan.videoBps}`);
  assert.equal(plan.targetBytes, 25_000_000);
});

test('long video at small target steps down the ladder', () => {
  // 10min@10MB: WebCodecs' 96k audio floor leaves no room for video — the
  // job must route to the ffmpeg engine (24k audio floor), where it fits.
  assert.throws(
    () => buildPlan({ mode: 'target', targetMB: 10 }, probe({ durationS: 600 })),
    (err: unknown) =>
      err instanceof CompressError && err.code === 'targetTooSmall',
  );
  const plan = buildPlan(
    { mode: 'target', targetMB: 10 },
    probe({ durationS: 600 }),
    undefined,
    24_000,
  );
  // ~115 kbps video at 10 minutes — must land on a small rung
  assert.ok(plan.width < 1920);
  assert.ok(plan.width <= 640, `width=${plan.width}`);
  const bpp = plan.videoBps / (plan.width * plan.height * plan.fps);
  assert.ok(bpp >= 0.03, `bpp=${bpp}`);
});

test('budget always under target: bits never exceed target bytes', () => {
  for (const targetMB of [8, 10, 16, 25, 50]) {
    for (const durationS of [10, 60, 300, 900, 1200]) {
      let plan;
      try {
        plan = buildPlan({ mode: 'target', targetMB }, probe({ durationS }));
      } catch (err) {
        assert.ok(err instanceof CompressError && err.code === 'targetTooSmall');
        continue;
      }
      const audioBits =
        plan.audioBps === null ? 128_000 * durationS : plan.audioBps * durationS;
      const totalBytes = (plan.videoBps * durationS + audioBits) / 8;
      assert.ok(
        totalBytes < targetMB * 1_000_000,
        `${targetMB}MB/${durationS}s: planned ${totalBytes} bytes`,
      );
    }
  }
});

test('20min into 8MB is refused rather than producing mush', () => {
  assert.throws(
    () => buildPlan({ mode: 'target', targetMB: 8 }, probe({ durationS: 1200 })),
    (err: unknown) =>
      err instanceof CompressError && err.code === 'targetTooSmall',
  );
});

test('high-bitrate audio gets re-encoded down, passthrough when it fits', () => {
  const fits = buildPlan(
    { mode: 'target', targetMB: 25 },
    probe({ durationS: 60, audio: { codec: 'aac', bitrate: 128_000 } }),
  );
  assert.equal(fits.audioBps, null); // passthrough

  const tight = buildPlan(
    { mode: 'target', targetMB: 8 },
    probe({ durationS: 300, audio: { codec: 'aac', bitrate: 320_000 } }),
  );
  assert.notEqual(tight.audioBps, null);
  assert.ok(tight.audioBps! <= 96_000);
  // WebCodecs default: never below the platform-AAC safe floor
  assert.ok(tight.audioBps! >= 96_000, `audioBps=${tight.audioBps}`);

  // ffmpeg engine cap allows the low ladder steps
  const ffmpegTight = buildPlan(
    { mode: 'target', targetMB: 8 },
    probe({ durationS: 300, audio: { codec: 'aac', bitrate: 320_000 } }),
    undefined,
    24_000,
  );
  assert.ok(ffmpegTight.audioBps! < 96_000, `audioBps=${ffmpegTight.audioBps}`);

  const opus = buildPlan(
    { mode: 'target', targetMB: 25 },
    probe({ durationS: 60, audio: { codec: 'opus', bitrate: 96_000 } }),
  );
  assert.notEqual(opus.audioBps, null); // non-AAC must re-encode
});

test('60fps source gets capped to 30 under pressure, kept when roomy', () => {
  const tight = buildPlan(
    { mode: 'target', targetMB: 10 },
    probe({ durationS: 300, fps: 60 }),
  );
  assert.ok(tight.fps <= 30, `fps=${tight.fps}`);

  const roomy = buildPlan(
    { mode: 'target', targetMB: 50 },
    probe({ durationS: 10, fps: 60 }),
  );
  assert.equal(roomy.fps, 60);
});

test('ladder never returns dims above source and respects min bpp', () => {
  const rung = pickLadderRung(3840, 2160, 30, 1_000_000);
  const bpp = 1_000_000 / (rung.width * rung.height * rung.fps);
  assert.ok(bpp >= 0.045, `bpp=${bpp}`);
  assert.ok(rung.width <= 3840);
});

test('video bitrate is capped at the source bitrate (no inflation)', () => {
  const plan = buildPlan(
    { mode: 'target', targetMB: 25 },
    probe({ durationS: 10, videoBitrate: 8_000_000 }),
  );
  assert.ok(plan.videoBps <= 8_000_000, `videoBps=${plan.videoBps}`);
});

test('retryVideoBps shrinks proportionally to overshoot', () => {
  const plan = buildPlan({ mode: 'target', targetMB: 25 }, probe({ durationS: 60 }));
  const next = retryVideoBps(plan, 27_000_000);
  // 25/27 * 0.93 ≈ 0.861
  assert.ok(next < plan.videoBps * 0.87);
  assert.ok(next > plan.videoBps * 0.8);
});

test('quality mode sets bpp-derived bitrate and no target', () => {
  const plan = buildPlan({ mode: 'quality', level: 'medium' }, probe({ durationS: 60 }));
  assert.equal(plan.targetBytes, null);
  const bpp = plan.videoBps / (plan.width * plan.height * plan.fps);
  assert.ok(Math.abs(bpp - 0.08) < 0.001);
});
