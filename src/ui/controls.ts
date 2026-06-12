import type { CompressOptions } from '../core/types';
import { h } from './dom';
import { t } from './i18n';

export interface ControlsConfig {
  /** Page preset; non-null locks target mode to this value. */
  lockedTargetMB: number | null;
  defaultTargetMB: number;
}

export interface Controls {
  el: HTMLElement;
  getOptions(): CompressOptions;
  setDisabled(disabled: boolean): void;
}

const PRESETS_MB = [8, 10, 16, 25, 50];
const CUSTOM_MIN = 2;
const CUSTOM_MAX = 512;

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
      getOptions: () => ({ mode: 'target', targetMB: config.lockedTargetMB! }),
      setDisabled: () => {},
    };
  }

  let mode: 'target' | 'quality' = 'target';
  let targetMB = config.defaultTargetMB;
  let quality: 'high' | 'medium' | 'low' = 'medium';

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
  customRadio.append(customInput);

  const targetFieldset = h(
    'fieldset',
    { class: 'control-group' },
    h('legend', {}, t('controls.target.legend')),
    ...presetRadios,
    customRadio,
  );

  const qualityFieldset = h(
    'fieldset',
    { class: 'control-group', hidden: true },
    h('legend', {}, t('controls.quality.legend')),
    ...(['high', 'medium', 'low'] as const).map((level) =>
      radio('quality-level', level, t(`controls.quality.${level}`), level === quality, () => {
        quality = level;
      }),
    ),
  );

  const modeFieldset = h(
    'fieldset',
    { class: 'control-group control-mode' },
    h('legend', {}, t('controls.mode.legend')),
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
  );

  const el = h('div', { class: 'controls' }, modeFieldset, targetFieldset, qualityFieldset);

  return {
    el,
    getOptions: () =>
      mode === 'target'
        ? { mode: 'target', targetMB }
        : { mode: 'quality', level: quality },
    setDisabled(disabled) {
      for (const input of el.querySelectorAll('input')) input.disabled = disabled;
    },
  };
}
