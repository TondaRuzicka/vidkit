// Output-format registry — the single source of truth for what VidKit can
// produce, the codecs each format uses, its file extension/MIME, and which
// engine renders it. Everything downstream (planning, engine selection, the
// engines themselves, the UI download name) reads from here so a new format is
// added in one place.

export type FormatId = 'mp4' | 'webm' | 'mov' | 'mkv' | 'm4a' | 'mp3' | 'gif';
export type FormatKind = 'video' | 'audio' | 'animation';

export interface OutputFormat {
  readonly id: FormatId;
  readonly kind: FormatKind;
  /** mediabunny container class key / ffmpeg muxer (inferred from extension). */
  readonly container: 'mp4' | 'mov' | 'mkv' | 'webm' | 'm4a' | 'mp3' | 'gif';
  /** WebCodecs/mediabunny video codec; null for audio-only and gif. */
  readonly videoCodec: 'avc' | 'vp9' | null;
  /** Audio codec; null = no audio track (gif). */
  readonly audioCodec: 'aac' | 'opus' | 'mp3' | null;
  readonly ext: string;
  readonly mime: string;
  /**
   * Engine that can actually produce this format. 'webcodecs' formats still
   * fall back to ffmpeg via the normal capability/reroute path; 'ffmpeg'
   * formats use codecs WebCodecs can't encode, so they go straight to ffmpeg.
   */
  readonly engine: 'webcodecs' | 'ffmpeg';
}

export const FORMATS: Record<FormatId, OutputFormat> = {
  // Container swaps over the universal H.264/AAC pair — WebCodecs fast path.
  mp4: { id: 'mp4', kind: 'video', container: 'mp4', videoCodec: 'avc', audioCodec: 'aac', ext: 'mp4', mime: 'video/mp4', engine: 'webcodecs' },
  mov: { id: 'mov', kind: 'video', container: 'mov', videoCodec: 'avc', audioCodec: 'aac', ext: 'mov', mime: 'video/quicktime', engine: 'webcodecs' },
  mkv: { id: 'mkv', kind: 'video', container: 'mkv', videoCodec: 'avc', audioCodec: 'aac', ext: 'mkv', mime: 'video/x-matroska', engine: 'webcodecs' },
  // WebCodecs can't encode these → ffmpeg.wasm.
  webm: { id: 'webm', kind: 'video', container: 'webm', videoCodec: 'vp9', audioCodec: 'opus', ext: 'webm', mime: 'video/webm', engine: 'ffmpeg' },
  m4a: { id: 'm4a', kind: 'audio', container: 'm4a', videoCodec: null, audioCodec: 'aac', ext: 'm4a', mime: 'audio/mp4', engine: 'ffmpeg' },
  mp3: { id: 'mp3', kind: 'audio', container: 'mp3', videoCodec: null, audioCodec: 'mp3', ext: 'mp3', mime: 'audio/mpeg', engine: 'ffmpeg' },
  gif: { id: 'gif', kind: 'animation', container: 'gif', videoCodec: null, audioCodec: null, ext: 'gif', mime: 'image/gif', engine: 'ffmpeg' },
};

export const DEFAULT_FORMAT: FormatId = 'mp4';

export const isFormatId = (s: string | undefined): s is FormatId =>
  s !== undefined && s in FORMATS;

export const formatOf = (id: FormatId | undefined): OutputFormat =>
  FORMATS[id ?? DEFAULT_FORMAT];
