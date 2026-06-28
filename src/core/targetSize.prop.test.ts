import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { CompressError, type ProbeResult } from './types.ts';
import { buildPlan, fitToLongEdge, pickLadderRung } from './targetSize.ts';

// Arbitrary realistic probe results: 1s–2h, 144p–8K, common fps, with or
// without audio, source bitrates from screen-recording-thin to ProRes-fat.
const probeArb: fc.Arbitrary<ProbeResult> = fc
  .record({
    durationS: fc.double({ min: 1, max: 7200, noNaN: true }),
    width: fc.integer({ min: 100, max: 7680 }),
    height: fc.integer({ min: 100, max: 7680 }),
    fps: fc.constantFrom(15, 23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120),
    videoBitrate: fc.oneof(
      fc.constant(null),
      fc.integer({ min: 100_000, max: 200_000_000 }),
    ),
    audio: fc.oneof(
      fc.constant(null),
      fc.record({
        codec: fc.constantFrom('aac', 'opus', 'mp3', 'ac3'),
        bitrate: fc.oneof(
          fc.constant(null),
          fc.integer({ min: 16_000, max: 512_000 }),
        ),
      }),
    ),
  })
  .map(({ durationS, width, height, fps, videoBitrate, audio }) => ({
    container: 'mp4',
    durationS,
    video: {
      codec: 'avc',
      width,
      height,
      fps,
      frameCount: Math.max(1, Math.round(fps * durationS)),
      bitrate: videoBitrate,
    },
    audio,
  }));

const targetMBArb = fc.oneof(
  fc.constantFrom(8, 10, 16, 25, 50),
  fc.integer({ min: 2, max: 512 }),
);

const audioFloorArb = fc.constantFrom(24_000, 96_000);

/** buildPlan either returns a plan or refuses with targetTooSmall. */
function planOrRefusal(
  targetMB: number,
  probe: ProbeResult,
  minAudioBps: number,
) {
  try {
    return buildPlan({ mode: 'target', targetMB }, probe, undefined, minAudioBps);
  } catch (err) {
    assert.ok(
      err instanceof CompressError && err.code === 'targetTooSmall',
      `unexpected error: ${err}`,
    );
    return null;
  }
}

test('property: planned bits never exceed the target', () => {
  fc.assert(
    fc.property(targetMBArb, probeArb, audioFloorArb, (targetMB, probe, floor) => {
      const plan = planOrRefusal(targetMB, probe, floor);
      if (plan === null) return; // refusal is always acceptable here
      const audioBits =
        plan.audioBps !== null
          ? plan.audioBps * probe.durationS
          : (probe.audio?.bitrate ?? 0) * probe.durationS; // passthrough
      const plannedBytes = (plan.videoBps * probe.durationS + audioBits) / 8;
      assert.ok(
        plannedBytes < targetMB * 1_000_000,
        `planned ${plannedBytes} ≥ target ${targetMB * 1e6} (${JSON.stringify(plan)})`,
      );
    }),
    { numRuns: 2000 },
  );
});

test('property: output dimensions never exceed source, always even, fps never raised', () => {
  fc.assert(
    fc.property(targetMBArb, probeArb, audioFloorArb, (targetMB, probe, floor) => {
      const plan = planOrRefusal(targetMB, probe, floor);
      if (plan === null) return;
      assert.ok(plan.width <= Math.max(probe.video.width, 2));
      assert.ok(plan.height <= Math.max(probe.video.height, 2));
      assert.equal(plan.width % 2, 0);
      assert.equal(plan.height % 2, 0);
      assert.ok(plan.fps <= Math.max(probe.video.fps, 15));
      assert.ok(plan.fps >= 15 || plan.fps === probe.video.fps);
    }),
    { numRuns: 2000 },
  );
});

test('property: accepted plans stay above the quality floor (bpp ≥ 0.03)', () => {
  fc.assert(
    fc.property(targetMBArb, probeArb, audioFloorArb, (targetMB, probe, floor) => {
      const plan = planOrRefusal(targetMB, probe, floor);
      if (plan === null) return;
      const bpp = plan.videoBps / (plan.width * plan.height * plan.fps);
      assert.ok(bpp >= 0.03, `bpp ${bpp} below floor`);
    }),
    { numRuns: 2000 },
  );
});

test('property: video bitrate never exceeds the source bitrate (no inflation)', () => {
  fc.assert(
    fc.property(targetMBArb, probeArb, audioFloorArb, (targetMB, probe, floor) => {
      const plan = planOrRefusal(targetMB, probe, floor);
      if (plan === null || probe.video.bitrate === null) return;
      assert.ok(plan.videoBps <= probe.video.bitrate);
    }),
    { numRuns: 2000 },
  );
});

test('property: audio re-encode bitrate respects the engine floor', () => {
  fc.assert(
    fc.property(targetMBArb, probeArb, audioFloorArb, (targetMB, probe, floor) => {
      const plan = planOrRefusal(targetMB, probe, floor);
      if (plan === null || plan.audioBps === null) return;
      assert.ok(
        plan.audioBps >= floor,
        `audioBps ${plan.audioBps} below floor ${floor}`,
      );
    }),
    { numRuns: 2000 },
  );
});

test('property: a looser audio floor never turns a feasible job infeasible', () => {
  fc.assert(
    fc.property(targetMBArb, probeArb, (targetMB, probe) => {
      const strict = planOrRefusal(targetMB, probe, 96_000);
      const loose = planOrRefusal(targetMB, probe, 24_000);
      if (strict !== null) {
        assert.notEqual(loose, null, 'feasible at 96k but not at 24k');
      }
    }),
    { numRuns: 2000 },
  );
});

test('property: fitToLongEdge preserves aspect ratio within rounding', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 16, max: 7680 }),
      fc.integer({ min: 16, max: 7680 }),
      fc.integer({ min: 16, max: 4320 }),
      (w, h, edge) => {
        // beyond 4:1 the 2px minimum clamp dominates — not realistic video
        fc.pre(w / h <= 4 && h / w <= 4);
        const out = fitToLongEdge(w, h, edge);
        const srcAR = w / h;
        const outAR = out.width / out.height;
        // even-rounding moves each dimension by up to 2px — the smaller the
        // output, the larger the legitimate AR drift
        const tolerance = 2 / out.width + 2 / out.height;
        assert.ok(
          Math.abs(srcAR - outAR) / srcAR <= tolerance,
          `AR drift ${srcAR} -> ${outAR} beyond tolerance ${tolerance} (${out.width}x${out.height})`,
        );
      },
    ),
    { numRuns: 2000 },
  );
});

test('property: ladder is monotone — more bitrate never picks a smaller rung', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 100_000, max: 50_000_000 }),
      fc.integer({ min: 100_000, max: 50_000_000 }),
      (a, b) => {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        let rungLo, rungHi;
        try {
          rungLo = pickLadderRung(1920, 1080, 30, lo);
          rungHi = pickLadderRung(1920, 1080, 30, hi);
        } catch {
          return; // refusals allowed at the low end
        }
        assert.ok(
          rungHi.width * rungHi.height * rungHi.fps >=
            rungLo.width * rungLo.height * rungLo.fps,
          `more bitrate picked smaller rung: ${lo}→${JSON.stringify(rungLo)} vs ${hi}→${JSON.stringify(rungHi)}`,
        );
      },
    ),
    { numRuns: 2000 },
  );
});
