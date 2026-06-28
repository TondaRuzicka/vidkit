import { FORMATS, type FormatId } from '../core/formats';
import { t } from './i18n';

// What the widget is actually doing, derived from the page's locked output
// format. Drives copy so a converter/extractor/GIF page doesn't say "compress".
export type Intent = 'compress' | 'convert' | 'audio' | 'gif';

/** null locked format = a compression page (format is selectable/defaulted). */
export function intentOf(lockedFormat: FormatId | null): Intent {
  if (!lockedFormat) return 'compress';
  const kind = FORMATS[lockedFormat].kind;
  return kind === 'audio' ? 'audio' : kind === 'animation' ? 'gif' : 'convert';
}

// Per-intent locale keys. The 'compress' column reuses the original base keys,
// so compression pages (and the e2e suite that reads them) are unchanged; the
// other intents get their own variants. All keys exist in every locale file.
const KEYS = {
  title:     { compress: 'widget.title',         convert: 'widget.title.convert',        audio: 'widget.title.audio',        gif: 'widget.title.gif' },
  start:     { compress: 'controls.start',        convert: 'controls.start.convert',       audio: 'controls.start.audio',       gif: 'controls.start.gif' },
  heading:   { compress: 'result.heading',        convert: 'result.heading.convert',       audio: 'result.heading.audio',       gif: 'result.heading.gif' },
  again:     { compress: 'result.again',          convert: 'result.again.convert',         audio: 'result.again.audio',         gif: 'result.again.gif' },
  stage:     { compress: 'progress.stage.encode', convert: 'progress.stage.encode.convert',audio: 'progress.stage.encode.audio',gif: 'progress.stage.encode.gif' },
  probing:   { compress: 'status.probing',        convert: 'status.probing',               audio: 'status.probing.audio',       gif: 'status.probing' },
  dropLabel: { compress: 'dropzone.label',        convert: 'dropzone.label',               audio: 'dropzone.label.audio',       gif: 'dropzone.label' },
  dropAgain: { compress: 'dropzone.replace',      convert: 'dropzone.replace',             audio: 'dropzone.replace.audio',     gif: 'dropzone.replace' },
  hint:      { compress: 'dropzone.hint',         convert: 'dropzone.hint',                audio: 'dropzone.hint.audio',        gif: 'dropzone.hint' },
} as const;

/** Resolve an intent-aware label (falls back to the compress copy by design). */
export function wl(
  intent: Intent,
  name: keyof typeof KEYS,
  params?: Record<string, string | number>,
): string {
  return t(KEYS[name][intent], params);
}
