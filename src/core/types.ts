import type { FormatId, OutputFormat } from './formats.ts';

/**
 * Keep only [startS, endS) of the source. Optional on every mode: the planner
 * budgets for the kept length and the engines cut while re-encoding, so a cut
 * is frame-accurate rather than keyframe-snapped.
 */
export interface TrimRange {
  startS: number;
  endS: number;
}

export type CompressOptions =
  | { format?: FormatId; mode: 'target'; targetMB: number; trim?: TrimRange }
  | { format?: FormatId; mode: 'quality'; level: 'high' | 'medium' | 'low'; trim?: TrimRange }
  // Audio extraction (m4a/mp3): a fixed audio bitrate, no video budget.
  | { format: FormatId; mode: 'audio'; audioKbps: number; trim?: TrimRange }
  // Animated GIF: width (long-edge cap) + frame rate; size is a result.
  | { format: FormatId; mode: 'gif'; width: number; fps: number; trim?: TrimRange };

export type EngineName = 'webcodecs' | 'ffmpeg';

export type ErrorCode =
  | 'cancelled'
  | 'notVideo'
  | 'targetTooSmall'
  | 'fileTooLargeForFallback'
  | 'noEngine'
  | 'decode'
  | 'encode'
  | 'unknown';

export interface ProbeResult {
  container: string;
  durationS: number;
  /** null for audio-only inputs (.m4a, .wav, .mp3) — valid for audio→audio jobs. */
  video: {
    codec: string | null;
    width: number;
    height: number;
    fps: number;
    frameCount: number;
    bitrate: number | null;
  } | null;
  audio: {
    codec: string | null;
    bitrate: number | null;
  } | null;
}

/** Everything an engine needs to produce one output file. */
export interface EncodePlan {
  /** Target container + codecs. Engines read this to know what to produce. */
  output: OutputFormat;
  width: number;
  height: number;
  fps: number;
  videoBps: number;
  /** null = passthrough the source audio unchanged */
  audioBps: number | null;
  keyFrameIntervalS: number;
  /** Present when the output is a cut of the source (see TrimRange). */
  trim?: TrimRange;
}

export interface ResultStats {
  inBytes: number;
  outBytes: number;
  /** Output format id — drives the download filename/extension and labels. */
  format: FormatId;
  width: number;
  height: number;
  fps: number;
  videoKbps: number;
  audioKbps: number | null;
  engine: EngineName;
  attempts: number;
  wallMs: number;
  /** Seconds of source kept when the job was trimmed; absent otherwise. */
  trimmedS?: number;
}

export type UiToWorker =
  | { type: 'start'; file: File; options: CompressOptions }
  | { type: 'cancel' };

export type WorkerToUi =
  | { type: 'probe'; meta: ProbeResult }
  | { type: 'engine'; engine: EngineName }
  | {
      type: 'progress';
      framesDone: number;
      framesTotal: number;
      etaMs: number | null;
      stage: 'probe' | 'encode' | 'retry';
    }
  | { type: 'done'; blob: Blob; stats: ResultStats }
  | {
      type: 'error';
      code: ErrorCode;
      detail?: string;
      /** For targetTooSmall: smallest whole-MB target this video can hit. */
      suggestedTargetMB?: number;
      /**
       * For targetTooSmall: longest opening stretch (whole seconds) that fits
       * the requested target — the "keep the target, cut the video" way out.
       */
      suggestedTrimS?: number;
    };

export class CompressError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, detail?: string) {
    super(detail ?? code);
    this.code = code;
  }
}
