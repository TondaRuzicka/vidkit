import { FORMATS, type FormatId } from '../core/formats';
import type { CompressOptions } from '../core/types';
import { h } from './dom';
import { t } from './i18n';

export interface ControlsConfig {
  /** Page preset; non-null locks target mode to this value. */
  lockedTargetMB: number | null;
  defaultTargetMB: number;
  /** Conversion pages fix the output format; null = user-selectable. */
  lockedFormat: FormatId | null;
  /** Initial output format when a selector is shown. */
  defaultFormat: FormatId;
  /** Formats offered in the selector; null/≤1 entries = no selector shown. */
  formatChoices: readonly FormatId[] | null;
}

/** Short display label for a format (universal, not translated). */
const FORMAT_LABEL: Record<FormatId, string> = {
  mp4: 'MP4', webm: 'WebM', mov: 'MOV', mkv: 'MKV', m4a: 'M4A', mp3: 'MP3', gif: 'GIF',
};

export interface Controls {
  el: HTMLElement;
  getOptions(): CompressOptions;
  setDisabled(disabled: boolean): void;
}

const PRESETS_MB = [8, 10, 16, 25, 50];
const CUSTOM_MIN = 2;
const CUSTOM_MAX = 512;
const AUDIO_KBPS = [320, 256, 192, 128];
const GIF_WIDTHS = [480, 320, 240];
const GIF_FPS = [15, 12, 10];

export function createControls(config: ControlsConfig): Controls {
  if (config.lockedTargetMB !== null) {
    // Locked pages (e.g. /compress-video-to-25mb/) show the target as plain
    // text — the page copy already explains it.
    const el = h(
      'p',
      { class: 'controls-locked' },
      t('controls.target.locked', { mb: config.lockedTargetMB }),
    );
    return {
      el,
      getOptions: () => ({
        format: config.lockedFormat ?? config.defaultFormat,
        mode: 'target',
        targetMB: config.lockedTargetMB!,
      }),
      setDisabled: () => {},
    };
  }

  let mode: 'target' | 'quality' = 'target';
  let targetMB = config.defaultTargetMB;
  let quality: 'high' | 'medium' | 'low' = 'medium';
  let format: FormatId = config.lockedFormat ?? config.defaultFormat;
  let audioKbps = 192;
  let gifWidth = GIF_WIDTHS[0]!;
  let gifFps = GIF_FPS[1]!;

  const radio = (
    name: string,
    value: string,
    labelText: string,
    checked: boolean,
    onChange: () => void,
  ) => {
    const input = h('input', { type: 'radio', name, value, ...(checked ? { checked: true } : {}) });
    input.addEventListener('change', () => input.checked && onChange());
    return h('label', { class: 'control-pill' }, input, h('span', {}, labelText));
  };

  const customInput = h('input', {
    type: 'number',
    min: String(CUSTOM_MIN),
    max: String(CUSTOM_MAX),
    step: '1',
    inputmode: 'numeric',
    class: 'control-custom-input',
    'aria-label': t('controls.target.customLabel'),
  });
  customInput.addEventListener('input', () => {
    const n = Number(customInput.value);
    if (Number.isFinite(n) && n >= CUSTOM_MIN && n <= CUSTOM_MAX) targetMB = n;
  });
  customInput.addEventListener('focus', () => {
    customRadio.querySelector('input')!.checked = true;
    const n = Number(customInput.value);
    targetMB = Number.isFinite(n) && n >= CUSTOM_MIN && n <= CUSTOM_MAX ? n : targetMB;
  });

  const presetRadios = PRESETS_MB.map((mb) =>
    radio('target-mb', String(mb), t('controls.target.preset', { mb }), mb === targetMB, () => {
      targetMB = mb;
    }),
  );
  const customRadio = radio('target-mb', 'custom', t('controls.target.custom'), false, () => {
    const n = Number(customInput.value);
    if (Number.isFinite(n) && n >= CUSTOM_MIN) targetMB = Math.min(n, CUSTOM_MAX);
    else customInput.focus();
  });
  customRadio.classList.add('control-pill--custom');
  customRadio.append(customInput);

  const targetFieldset = h(
    'fieldset',
    { class: 'control-group' },
    h('legend', {}, t('controls.target.legend')),
    h('div', { class: 'control-pills' }, ...presetRadios, customRadio),
  );

  // Quality is bits-per-pixel based, so the exact bitrate depends on the
  // source. The hint gives a concrete "~X Mbps for 1080p" anchor per level so
  // High/Medium/Low aren't vague; it updates as the selection changes.
  const qualityHint = h('p', { class: 'control-hint' });
  const updateQualityHint = () => {
    qualityHint.textContent = t(`controls.quality.${quality}.desc`);
  };
  const qualityFieldset = h(
    'fieldset',
    { class: 'control-group', hidden: true },
    h('legend', {}, t('controls.quality.legend')),
    h(
      'div',
      { class: 'control-pills' },
      ...(['high', 'medium', 'low'] as const).map((level) =>
        radio('quality-level', level, t(`controls.quality.${level}`), level === quality, () => {
          quality = level;
          updateQualityHint();
        }),
      ),
    ),
    qualityHint,
  );
  updateQualityHint();

  const audioFieldset = h(
    'fieldset',
    { class: 'control-group', hidden: true },
    h('legend', {}, t('controls.audio.legend')),
    h(
      'div',
      { class: 'control-pills' },
      ...AUDIO_KBPS.map((kbps) =>
        radio('audio-kbps', String(kbps), t('controls.audio.preset', { kbps }), kbps === audioKbps, () => {
          audioKbps = kbps;
        }),
      ),
    ),
  );

  const gifFieldset = h(
    'fieldset',
    { class: 'control-group', hidden: true },
    h('legend', {}, t('controls.gif.width')),
    h(
      'div',
      { class: 'control-pills' },
      ...GIF_WIDTHS.map((w) =>
        radio('gif-width', String(w), t('controls.gif.widthPreset', { w }), w === gifWidth, () => {
          gifWidth = w;
        }),
      ),
    ),
    h('legend', {}, t('controls.gif.fps')),
    h(
      'div',
      { class: 'control-pills' },
      ...GIF_FPS.map((f) =>
        radio('gif-fps', String(f), t('controls.gif.fpsPreset', { fps: f }), f === gifFps, () => {
          gifFps = f;
        }),
      ),
    ),
  );

  const modeFieldset = h(
    'fieldset',
    { class: 'control-group control-mode' },
    h('legend', {}, t('controls.mode.legend')),
    h(
      'div',
      { class: 'control-pills' },
      radio('mode', 'target', t('controls.mode.target'), true, () => {
        mode = 'target';
        targetFieldset.hidden = false;
        qualityFieldset.hidden = true;
      }),
      radio('mode', 'quality', t('controls.mode.quality'), false, () => {
        mode = 'quality';
        targetFieldset.hidden = true;
        qualityFieldset.hidden = false;
      }),
    ),
  );

  // Output-format selector — shown only when the page offers a choice and
  // doesn't lock the format. Conversion landing pages lock it instead.
  const showFormatSelector =
    config.lockedFormat === null &&
    config.formatChoices !== null &&
    config.formatChoices.length > 1;

  // Show only the control groups relevant to the chosen format's kind.
  const applyKind = () => {
    const kind = FORMATS[format].kind;
    modeFieldset.hidden = kind !== 'video';
    targetFieldset.hidden = kind !== 'video' || mode !== 'target';
    qualityFieldset.hidden = kind !== 'video' || mode !== 'quality';
    audioFieldset.hidden = kind !== 'audio';
    gifFieldset.hidden = kind !== 'animation';
  };

  const formatFieldset = showFormatSelector
    ? h(
        'fieldset',
        { class: 'control-group control-format' },
        h('legend', {}, t('controls.format.legend')),
        h(
          'div',
          { class: 'control-pills' },
          ...config.formatChoices!.map((id) =>
            radio('output-format', id, FORMAT_LABEL[id], id === format, () => {
              format = id;
              applyKind();
            }),
          ),
        ),
      )
    : null;

  const el = h(
    'div',
    { class: 'controls' },
    ...(formatFieldset ? [formatFieldset] : []),
    modeFieldset,
    targetFieldset,
    qualityFieldset,
    audioFieldset,
    gifFieldset,
  );
  applyKind(); // honour the initial (possibly locked) format

  return {
    el,
    getOptions: (): CompressOptions => {
      const kind = FORMATS[format].kind;
      if (kind === 'audio') return { format, mode: 'audio', audioKbps };
      if (kind === 'animation') return { format, mode: 'gif', width: gifWidth, fps: gifFps };
      return mode === 'target'
        ? { format, mode: 'target', targetMB }
        : { format, mode: 'quality', level: quality };
    },
    setDisabled(disabled) {
      for (const input of el.querySelectorAll('input')) input.disabled = disabled;
    },
  };
}
