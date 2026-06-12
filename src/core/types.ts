export type CompressOptions =
  | { mode: 'target'; targetMB: number }
  | { mode: 'quality'; level: 'high' | 'medium' | 'low' };

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
  video: {
    codec: string | null;
    width: number;
    height: number;
    fps: number;
    frameCount: number;
    bitrate: number | null;
  };
  audio: {
    codec: string | null;
    bitrate: number | null;
  } | null;
}

/** Everything an engine needs to produce one output file. */
export interface EncodePlan {
  width: number;
  height: number;
  fps: number;
  videoBps: number;
  /** null = passthrough the source audio unchanged */
  audioBps: number | null;
  keyFrameIntervalS: number;
}

export interface ResultStats {
  inBytes: number;
  outBytes: number;
  width: number;
  height: number;
  fps: number;
  videoKbps: number;
  audioKbps: number | null;
  engine: EngineName;
  attempts: number;
  wallMs: number;
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
      stage: 'probe' | 'encode' | 'retry' | 'finalize';
    }
  | { type: 'done'; blob: Blob; stats: ResultStats }
  | { type: 'error'; code: ErrorCode; detail?: string };

export class CompressError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, detail?: string) {
    super(detail ?? code);
    this.code = code;
  }
}
