import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompress, type CompressDeps } from './compress.ts';
import { WEBCODECS_MIN_AUDIO_BPS } from './targetSize.ts';
import { CompressError, type EngineName, type ProbeResult } from './types.ts';

// ---- fakes ----------------------------------------------------------------

const META: ProbeResult = {
  container: 'mp4',
  durationS: 60,
  video: { codec: 'avc', width: 1920, height: 1080, fps: 30, frameCount: 1800, bitrate: 8_000_000 },
  audio: { codec: 'aac', bitrate: 128_000 },
};

const FILE = new File([new Uint8Array(1000)], 'in.mp4', { type: 'video/mp4' });

interface FakeEngineScript {
  /** Per attempt: output size as a fraction of plan.targetBytes, or an error code. */
  attempts: (number | 'decode' | 'encode' | 'cancelled')[];
}

function fakeEngine(script: FakeEngineScript, log: string[], name: string) {
  let attempt = 0;
  return {
    run: async (
      _file: File,
      plan: { targetBytes: number | null; videoBps: number },
      callbacks: { onProgress: (f: number) => void },
    ) => {
      const step = script.attempts[Math.min(attempt, script.attempts.length - 1)]!;
      attempt++;
      log.push(`${name}.run#${attempt} videoBps=${plan.videoBps}`);
      callbacks.onProgress(0.5);
      if (typeof step === 'string') throw new CompressError(step);
      const bytes = Math.round((plan.targetBytes ?? 10_000_000) * step);
      return new Blob([new Uint8Array(bytes)]);
    },
  };
}

function deps(over: {
  webcodecs?: FakeEngineScript;
  ffmpeg?: FakeEngineScript;
  select?: EngineName;
  forced?: EngineName | null;
  log?: string[];
}): { deps: CompressDeps; log: string[] } {
  const log = over.log ?? [];
  return {
    log,
    deps: {
      probeAny: async () => ({ meta: META, forcedEngine: over.forced ?? null }),
      selectEngine: async () => ({ name: over.select ?? 'webcodecs', reason: 'test' }),
      engines: {
        webcodecs: {
          engine: fakeEngine(over.webcodecs ?? { attempts: [0.9] }, log, 'webcodecs'),
          minAudioBps: WEBCODECS_MIN_AUDIO_BPS,
        },
        ffmpeg: {
          engine: fakeEngine(over.ffmpeg ?? { attempts: [0.9] }, log, 'ffmpeg'),
          minAudioBps: 24_000,
        },
      },
      now: () => 0,
    },
  };
}

const noopCallbacks = () => {
  const engines: EngineName[] = [];
  const stages: string[] = [];
  return {
    engines,
    stages,
    callbacks: {
      onProbe: () => {},
      onEngine: (e: EngineName) => engines.push(e),
      onProgress: (_f: number, stage: string) => {
        if (stages.at(-1) !== stage) stages.push(stage);
      },
    },
  };
};

const run = (d: CompressDeps, cb = noopCallbacks().callbacks) =>
  createCompress(d)(FILE, { mode: 'target', targetMB: 25 }, cb, new AbortController().signal);

// ---- tests ----------------------------------------------------------------

test('happy path: one attempt, result under target, stats correct', async () => {
  const { deps: d } = deps({ webcodecs: { attempts: [0.93] } });
  const { blob, stats } = await run(d);
  assert.ok(blob.size <= 25_000_000);
  assert.equal(stats.engine, 'webcodecs');
  assert.equal(stats.attempts, 1);
  assert.equal(stats.outBytes, blob.size);
});

test('verify-retry: overshooting encoder is retried at lower bitrate, never returns over target', async () => {
  const { deps: d, log } = deps({ webcodecs: { attempts: [1.08, 0.95] } });
  const cb = noopCallbacks();
  const { stats } = await createCompress(d)(
    FILE, { mode: 'target', targetMB: 25 }, cb.callbacks, new AbortController().signal,
  );
  assert.equal(stats.attempts, 2);
  assert.ok(stats.outBytes <= 25_000_000);
  // second attempt must use a strictly lower bitrate
  const bps = log.map((l) => Number(l.match(/videoBps=(\d+)/)![1]));
  assert.ok(bps[1]! < bps[0]!, `expected shrink, got ${bps}`);
  assert.deepEqual(cb.stages, ['encode', 'retry']);
});

test('webcodecs exhausting retries falls back to ffmpeg rather than erroring', async () => {
  // Hardware encoders can be too loose to hit a target; x264's VBV is not.
  // Retry exhaustion on webcodecs should give ffmpeg a chance.
  const { deps: d, log } = deps({
    webcodecs: { attempts: [1.5, 1.5, 1.5] },
    ffmpeg: { attempts: [0.9] },
  });
  const { stats } = await run(d);
  assert.equal(stats.engine, 'ffmpeg');
  assert.ok(stats.outBytes <= 25_000_000);
  assert.equal(log.filter((l) => l.startsWith('webcodecs')).length, 3);
});

test('both engines exhausting retries errors out, never ships over-target', async () => {
  const { deps: d, log } = deps({
    webcodecs: { attempts: [1.5, 1.5, 1.5] },
    ffmpeg: { attempts: [1.5, 1.5, 1.5] },
  });
  await assert.rejects(run(d), (err: unknown) => {
    assert.ok(err instanceof CompressError && err.code === 'encode');
    assert.match(err.message, /still over target/);
    return true;
  });
  assert.equal(log.length, 6); // 3 attempts on each engine, then give up
});

test('decode failure on webcodecs reroutes once to ffmpeg', async () => {
  const { deps: d, log } = deps({
    webcodecs: { attempts: ['decode'] },
    ffmpeg: { attempts: [0.9] },
  });
  const cb = noopCallbacks();
  const { stats } = await createCompress(d)(
    FILE, { mode: 'target', targetMB: 25 }, cb.callbacks, new AbortController().signal,
  );
  assert.equal(stats.engine, 'ffmpeg');
  assert.deepEqual(cb.engines, ['webcodecs', 'ffmpeg']);
  assert.deepEqual(log, ['webcodecs.run#1 videoBps=' + log[0]!.split('=')[1], 'ffmpeg.run#1 videoBps=' + log[1]!.split('=')[1]]);
});

test('ffmpeg failure does NOT reroute (no loop)', async () => {
  const { deps: d } = deps({ forced: 'ffmpeg', ffmpeg: { attempts: ['encode'] } });
  await assert.rejects(run(d), (err: unknown) =>
    err instanceof CompressError && err.code === 'encode');
});

test('cancellation is not treated as an engine failure (no reroute)', async () => {
  const { deps: d, log } = deps({ webcodecs: { attempts: ['cancelled'] } });
  await assert.rejects(run(d), (err: unknown) =>
    err instanceof CompressError && err.code === 'cancelled');
  assert.equal(log.length, 1, 'must not have tried ffmpeg after cancel');
});

test('forced engine (AVI path) skips selection and runs ffmpeg', async () => {
  const { deps: d, log } = deps({ forced: 'ffmpeg', ffmpeg: { attempts: [0.9] } });
  const { stats } = await run(d);
  assert.equal(stats.engine, 'ffmpeg');
  assert.equal(log.length, 1);
  assert.match(log[0]!, /^ffmpeg\./);
});

test('infeasible under webcodecs audio floor falls through to ffmpeg planning', async () => {
  // 10min video + 10MB target: audio at the 96k WebCodecs floor eats the
  // budget; at ffmpeg's 32k ladder step it fits — orchestrator must pick
  // ffmpeg without engine errors.
  const longMeta: ProbeResult = {
    ...META,
    durationS: 600,
    video: { ...META.video, frameCount: 18000 },
  };
  const { deps: d } = deps({ ffmpeg: { attempts: [0.9] } });
  d.probeAny = async () => ({ meta: longMeta, forcedEngine: null });
  const cb = noopCallbacks();
  const { stats } = await createCompress(d)(
    FILE, { mode: 'target', targetMB: 10 }, cb.callbacks, new AbortController().signal,
  );
  assert.equal(stats.engine, 'ffmpeg');
  assert.deepEqual(cb.engines, ['ffmpeg']);
});

test('truly impossible target propagates targetTooSmall from both engines', async () => {
  const longMeta: ProbeResult = {
    ...META,
    durationS: 7200,
    video: { ...META.video, frameCount: 216000 },
  };
  const { deps: d } = deps({});
  d.probeAny = async () => ({ meta: longMeta, forcedEngine: null });
  await assert.rejects(
    createCompress(d)(FILE, { mode: 'target', targetMB: 2 }, noopCallbacks().callbacks, new AbortController().signal),
    (err: unknown) => err instanceof CompressError && err.code === 'targetTooSmall',
  );
});

test('quality mode: no verify loop even when output is large', async () => {
  // fraction is relative to a fixed 10MB stand-in (targetBytes null)
  const { deps: d, log } = deps({ webcodecs: { attempts: [5.0] } });
  const { stats } = await createCompress(d)(
    FILE, { mode: 'quality', level: 'medium' }, noopCallbacks().callbacks, new AbortController().signal,
  );
  assert.equal(stats.attempts, 1);
  assert.equal(log.length, 1);
});
