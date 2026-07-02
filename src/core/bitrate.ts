import {
  MIN_BPP,
  OVERHEAD_FIXED_BYTES,
  OVERHEAD_PER_FRAME_BYTES,
} from './targetSize.ts';

// AAC emits ~43–44 packets/second at 1024 samples per frame; matches the
// container-overhead model buildPlan() uses so the calculator's answer lines
// up with what the compressor actually produces.
const AUDIO_PACKETS_PER_S = 44;

// bits-per-pixel-per-frame above which H.264 looks crisp. The compressor treats
// MIN_BPP (~0.045) as the watchable floor; between the two is "soft".
export const CRISP_BPP = 0.1;

/** Reference 16:9 rungs, high→low, for the "best resolution that fits" hint. */
const RES_LADDER = [
  { label: '4K', w: 3840, h: 2160 },
  { label: '1440p', w: 2560, h: 1440 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '720p', w: 1280, h: 720 },
  { label: '480p', w: 854, h: 480 },
  { label: '360p', w: 640, h: 360 },
] as const;

export type Verdict =
  | 'ok' // crisp at recommendedRes (highest rung that stays >= CRISP_BPP)
  | 'soft' // positive video budget, but only ~360p stays watchable
  | 'tight' // even 360p would be blocky
  | 'tooSmall'; // no room left for video after audio + container overhead

export interface CalcInput {
  targetBytes: number; // desired output file size, bytes (decimal MB)
  durationS: number; // clip length in seconds
  audioBps: number; // audio bitrate; 0 = no audio track
  fps: number; // frame rate (affects overhead and the resolution hint)
}

export interface CalcResult {
  verdict: Verdict;
  totalBps: number; // average total bitrate (video + audio)
  videoBps: number; // video-only average bitrate
  audioBps: number;
  overheadBytes: number;
  recommendedRes: string | null; // e.g. "1080p"; null when even 360p is blocky
}

/**
 * Given a target size, clip length and audio bitrate, work out the average
 * bitrate the video track can use — the same budget arithmetic the compressor
 * runs, exposed as a standalone answer. Pure and unit-testable.
 */
export function calcBitrate({
  targetBytes,
  durationS,
  audioBps,
  fps,
}: CalcInput): CalcResult {
  const empty = {
    totalBps: 0,
    videoBps: 0,
    audioBps,
    overheadBytes: 0,
    recommendedRes: null,
  } as const;
  if (!(durationS > 0) || !(targetBytes > 0) || !(fps > 0)) {
    return { verdict: 'tooSmall', ...empty };
  }

  const audioPackets = audioBps > 0 ? Math.round(durationS * AUDIO_PACKETS_PER_S) : 0;
  const frameEstimate = Math.round(fps * durationS) + audioPackets;
  const overheadBytes = OVERHEAD_PER_FRAME_BYTES * frameEstimate + OVERHEAD_FIXED_BYTES;
  const usableBits = (targetBytes - overheadBytes) * 8;
  const totalBps = Math.max(0, Math.floor(usableBits / durationS));
  const videoBps = Math.floor((usableBits - audioBps * durationS) / durationS);

  if (videoBps <= 0) {
    return { verdict: 'tooSmall', totalBps, videoBps: 0, audioBps, overheadBytes, recommendedRes: null };
  }

  let crisp: string | null = null;
  for (const r of RES_LADDER) {
    if (videoBps / (r.w * r.h * fps) >= CRISP_BPP) {
      crisp = r.label;
      break;
    }
  }
  const smallest = RES_LADDER[RES_LADDER.length - 1]!;
  const bppFloor = videoBps / (smallest.w * smallest.h * fps);

  let verdict: Verdict;
  let recommendedRes: string | null;
  if (crisp) {
    verdict = 'ok';
    recommendedRes = crisp;
  } else if (bppFloor >= MIN_BPP) {
    verdict = 'soft';
    recommendedRes = smallest.label;
  } else {
    verdict = 'tight';
    recommendedRes = null;
  }
  return { verdict, totalBps, videoBps, audioBps, overheadBytes, recommendedRes };
}
