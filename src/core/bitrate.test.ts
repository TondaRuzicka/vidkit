import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcBitrate } from './bitrate.ts';

const MB = 1_000_000;

test('matches the size/duration formula, minus container overhead', () => {
  // 10 MB, 60 s, no audio, 30 fps. Naive video budget is 10e6*8/60 ≈ 1.333 Mbps;
  // container overhead trims a little, so the answer must be just under that.
  const r = calcBitrate({ targetBytes: 10 * MB, durationS: 60, audioBps: 0, fps: 30 });
  assert.equal(r.verdict, 'ok');
  const naive = (10 * MB * 8) / 60;
  assert.ok(r.videoBps < naive, 'overhead not subtracted');
  assert.ok(r.videoBps > naive * 0.98, `too much overhead: ${r.videoBps}`);
  assert.equal(r.videoBps, r.totalBps, 'no audio → video == total');
});

test('audio reserves its share of the budget', () => {
  const noAudio = calcBitrate({ targetBytes: 25 * MB, durationS: 120, audioBps: 0, fps: 30 });
  const withAudio = calcBitrate({ targetBytes: 25 * MB, durationS: 120, audioBps: 128_000, fps: 30 });
  // Video budget drops by the audio bitrate plus the extra container overhead
  // of the audio packets — so a little over 128 kbps, never less.
  const drop = noAudio.videoBps - withAudio.videoBps;
  assert.ok(drop >= 128_000 && drop < 134_000, `expected ~128k drop, got ${drop}`);
  assert.equal(withAudio.audioBps, 128_000);
});

test('longer clips step the recommended resolution down', () => {
  const short = calcBitrate({ targetBytes: 25 * MB, durationS: 30, audioBps: 128_000, fps: 30 });
  const long = calcBitrate({ targetBytes: 25 * MB, durationS: 600, audioBps: 128_000, fps: 30 });
  assert.ok(short.videoBps > long.videoBps);
  // Same size spread over 20x the time can't hold the same resolution.
  assert.notEqual(short.recommendedRes, long.recommendedRes);
});

test('bigger target is monotonic in video bitrate', () => {
  const base = { durationS: 180, audioBps: 128_000, fps: 30 };
  let prev = -1;
  for (const mb of [8, 10, 25, 50, 100]) {
    const { videoBps } = calcBitrate({ targetBytes: mb * MB, ...base });
    assert.ok(videoBps > prev, `not increasing at ${mb} MB`);
    prev = videoBps;
  }
});

test('target too small for audio + overhead is flagged, not negative', () => {
  const r = calcBitrate({ targetBytes: 1 * MB, durationS: 3600, audioBps: 128_000, fps: 30 });
  assert.equal(r.verdict, 'tooSmall');
  assert.equal(r.videoBps, 0);
});

test('generous budget recommends a high resolution', () => {
  const r = calcBitrate({ targetBytes: 500 * MB, durationS: 60, audioBps: 128_000, fps: 30 });
  assert.equal(r.verdict, 'ok');
  assert.ok(['4K', '1440p', '1080p'].includes(r.recommendedRes!), r.recommendedRes ?? 'null');
});

test('zero or negative inputs never throw', () => {
  for (const bad of [
    { targetBytes: 0, durationS: 60, audioBps: 0, fps: 30 },
    { targetBytes: 10 * MB, durationS: 0, audioBps: 0, fps: 30 },
    { targetBytes: 10 * MB, durationS: 60, audioBps: 0, fps: 0 },
  ]) {
    const r = calcBitrate(bad);
    assert.equal(r.verdict, 'tooSmall');
  }
});
