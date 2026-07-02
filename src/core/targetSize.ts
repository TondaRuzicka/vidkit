import { formatOf } from './formats.ts';
import { CompressError, type CompressOptions, type EncodePlan, type ProbeResult } from './types.ts';

// All tunables in one place — adjust here after measuring real encoders.
export const SAFETY_FACTOR = 0.95; // fraction of target we budget for
export const RETRY_SHRINK = 0.93; // extra shrink on verify-retry
export const MAX_ATTEMPTS = 3; // 1 encode + 2 retries
// Floor on average video bitrate; quality is governed by FLOOR_BPP (the
// ladder shrinks resolution first), so this only rejects absurd budgets.
const MIN_VIDEO_BPS = 50_000;
export const MIN_BPP = 0.045; // below this H.264 turns to mush; also the calculator's watchable floor
const FLOOR_BPP = 0.03; // refuse outright below this at the floor rung
const AUDIO_LADDER_BPS = [128_000, 96_000, 64_000, 48_000, 32_000];
const MAX_AUDIO_BUDGET_SHARE = 0.15;
/**
 * Platform AAC encoders (macOS via Chrome's AudioEncoder) are unstable below
 * ~96 kbps stereo: nondeterministic EncodingErrors, and repeated configure
 * attempts can crash the renderer. The WebCodecs path never re-encodes below
 * this; lower rates are reserved for the ffmpeg engine (software encoder).
 */
export const WEBCODECS_MIN_AUDIO_BPS = 96_000;
const LONG_EDGE_LADDER = [2160, 1440, 1080, 864, 720, 640, 540, 480, 426, 320];
const FPS_LADDER = [24, 20, 15];
/** Per-frame container overhead (sample tables in moov) plus fixed boxes. */
export const OVERHEAD_PER_FRAME_BYTES = 12;
export const OVERHEAD_FIXED_BYTES = 4096;

export interface BudgetPlan extends EncodePlan {
  targetBytes: number | null; // null in quality mode (no verify loop)
}

/** Map of quality levels to bits-per-pixel at the encode resolution. */
const QUALITY_BPP = { high: 0.12, medium: 0.08, low: 0.05 } as const;
const QUALITY_MAX_LONG_EDGE = { high: Infinity, medium: 1920, low: 1920 } as const;

// Round DOWN to even: rounding up could exceed the source dimension
// (e.g. a 103px source planning a 104px output = accidental upscale).
const even = (n: number) => Math.max(2, 2 * Math.floor(n / 2));

/** Scale source dims so the longer edge equals `longEdge`, preserving AR. */
export function fitToLongEdge(
  w: number,
  h: number,
  longEdge: number,
): { width: number; height: number } {
  const scale = longEdge / Math.max(w, h);
  if (scale >= 1) return { width: even(w), height: even(h) };
  return { width: even(w * scale), height: even(h * scale) };
}

const bpp = (videoBps: number, w: number, h: number, fps: number) =>
  videoBps / (w * h * fps);

/**
 * Pick output resolution and fps for a given video bitrate so that
 * bits-per-pixel stays above the watchability threshold. Never upscales.
 */
export function pickLadderRung(
  srcW: number,
  srcH: number,
  srcFps: number,
  videoBps: number,
  srcVideoBps: number | null = null,
): { width: number; height: number; fps: number } {
  const srcLongEdge = Math.max(srcW, srcH);
  let fps = Math.min(srcFps, 60);

  // Cheap first lever: 60fps content rarely survives tight budgets. Only
  // when actually compressing below the source bitrate — at parity, keep
  // the source frame rate even if bpp looks low on paper.
  const reallyCompressing =
    srcVideoBps === null || videoBps < srcVideoBps * 0.75;
  if (srcFps > 32 && reallyCompressing) {
    const { width, height } = fitToLongEdge(srcW, srcH, srcLongEdge);
    if (bpp(videoBps, width, height, fps) < 0.09) fps = 30;
  }

  // Source resolution is the implicit top rung — only step down from there.
  const rungs = [
    srcLongEdge,
    ...LONG_EDGE_LADDER.filter((e) => e < srcLongEdge),
  ];
  for (const longEdge of rungs) {
    const { width, height } = fitToLongEdge(srcW, srcH, longEdge);
    if (bpp(videoBps, width, height, fps) >= MIN_BPP) {
      return { width, height, fps };
    }
  }

  // Bottom rung: drop fps before giving up.
  const floorEdge = Math.min(320, srcLongEdge);
  const { width, height } = fitToLongEdge(srcW, srcH, floorEdge);
  for (const lowFps of FPS_LADDER) {
    if (lowFps > fps) continue;
    if (bpp(videoBps, width, height, lowFps) >= MIN_BPP) {
      return { width, height, fps: lowFps };
    }
  }

  const lastFps = Math.min(fps, FPS_LADDER[FPS_LADDER.length - 1]!);
  if (bpp(videoBps, width, height, lastFps) >= FLOOR_BPP) {
    return { width, height, fps: lastFps };
  }
  throw new CompressError('targetTooSmall');
}

/**
 * Turn user options + probe data into a concrete encode plan.
 * Pure function — unit-testable without a browser.
 */
export function buildPlan(
  options: CompressOptions,
  probe: ProbeResult,
  /** Override for retry passes; first pass leaves it undefined. */
  videoBpsOverride?: number,
  /** Engine capability: lowest audio re-encode bitrate it can do safely. */
  minAudioBps: number = WEBCODECS_MIN_AUDIO_BPS,
): BudgetPlan {
  const { durationS, video, audio } = probe;
  const output = formatOf(options.format);

  // Audio extraction: fixed bitrate, no video, no verify loop.
  if (options.mode === 'audio') {
    return {
      output,
      width: 0,
      height: 0,
      fps: 0,
      videoBps: 0,
      audioBps: options.audioKbps * 1000,
      keyFrameIntervalS: 2,
      targetBytes: null,
    };
  }

  // Every mode below needs a video track. Audio-only inputs only make sense
  // for the audio mode handled above; reject them here rather than NPE.
  if (!video) throw new CompressError('notVideo', 'this output needs a video track');

  // Animated GIF: width is a long-edge cap; fps is throttled to the source.
  if (options.mode === 'gif') {
    const { width, height } = fitToLongEdge(video.width, video.height, options.width);
    return {
      output,
      width,
      height,
      fps: Math.min(video.fps, options.fps),
      videoBps: 0,
      audioBps: null,
      keyFrameIntervalS: 2,
      targetBytes: null,
    };
  }

  if (options.mode === 'quality') {
    const maxEdge = QUALITY_MAX_LONG_EDGE[options.level];
    const longEdge = Math.min(Math.max(video.width, video.height), maxEdge);
    const { width, height } = fitToLongEdge(video.width, video.height, longEdge);
    const fps = Math.min(video.fps, 60);
    return {
      output,
      width,
      height,
      fps,
      videoBps: Math.round(QUALITY_BPP[options.level] * width * height * fps),
      // Source audio passes through only when it already matches the output
      // codec; otherwise re-encode at 128k.
      audioBps: audio && audio.codec !== output.audioCodec ? 128_000 : null,
      keyFrameIntervalS: 2,
      targetBytes: null,
    };
  }

  const targetBytes = Math.round(options.targetMB * 1_000_000);
  const frameEstimate =
    video.frameCount + (audio ? Math.round(durationS * 44) : 0); // + audio packets
  const overhead =
    OVERHEAD_PER_FRAME_BYTES * frameEstimate + OVERHEAD_FIXED_BYTES;
  const usableBits = (targetBytes - overhead) * 8 * SAFETY_FACTOR;
  if (usableBits <= 0) throw new CompressError('targetTooSmall');

  // Audio: passthrough if the source track fits comfortably in its share,
  // else re-encode at the largest ladder step that fits.
  let audioBps: number | null = null;
  let audioBitsTotal = 0;
  if (audio) {
    const audioShareBits = usableBits * MAX_AUDIO_BUDGET_SHARE;
    if (
      audio.codec === output.audioCodec &&
      audio.bitrate !== null &&
      audio.bitrate * durationS <= audioShareBits
    ) {
      audioBps = null; // passthrough
      audioBitsTotal = audio.bitrate * durationS;
    } else {
      // Largest ladder step inside the audio share, but never below what the
      // engine can encode safely — tight budgets borrow from video instead.
      const ladder = AUDIO_LADDER_BPS.filter((b) => b >= minAudioBps);
      const fitting = ladder.find((b) => b * durationS <= audioShareBits);
      audioBps = fitting ?? ladder[ladder.length - 1] ?? minAudioBps;
      audioBitsTotal = audioBps * durationS;
    }
  }

  // Never plan more bits than the source has — re-encoding can only lose
  // quality, so a budget above the source bitrate would inflate the file.
  const sourceCap =
    video.bitrate !== null && !videoBpsOverride ? video.bitrate : Infinity;
  const videoBps = Math.floor(
    Math.min(
      videoBpsOverride ?? (usableBits - audioBitsTotal) / durationS,
      sourceCap,
    ),
  );
  if (videoBps < MIN_VIDEO_BPS) throw new CompressError('targetTooSmall');

  const rung = pickLadderRung(
    video.width,
    video.height,
    video.fps,
    videoBps,
    video.bitrate,
  );
  return {
    output,
    ...rung,
    videoBps,
    audioBps,
    keyFrameIntervalS: 2,
    targetBytes,
  };
}

/** Bitrate for the next attempt after an oversized result. */
export function retryVideoBps(
  plan: BudgetPlan,
  actualBytes: number,
): number {
  if (plan.targetBytes === null) throw new CompressError('unknown');
  return Math.floor(
    plan.videoBps * (plan.targetBytes / actualBytes) * RETRY_SHRINK,
  );
}
