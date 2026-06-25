import { formatBytes, h, icon } from './dom';
import { t } from './i18n';

export interface Dropzone {
  el: HTMLElement;
  /** Show the picked file (or reset with null). */
  setFile(file: File | null): void;
  onFile: (file: File) => void;
}

const UPLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

/**
 * A real <button> opens the picker (keyboard-accessible for free); the
 * wrapper accepts drag-and-drop. The file input itself stays visually
 * hidden but functional.
 */
export function createDropzone(): Dropzone {
  const input = h('input', {
    type: 'file',
    accept: 'video/*,.mkv,.avi,.mov,.webm,.mp4',
    class: 'visually-hidden',
    'aria-hidden': 'true',
    tabindex: '-1',
  });
  const iconEl = h('span', { class: 'dropzone__icon' }, icon(UPLOAD_ICON));
  const hint = h('p', { class: 'dropzone__hint', id: 'dropzone-hint' }, t('dropzone.hint'));
  const button = h(
    'button',
    { type: 'button', class: 'dropzone-button', 'aria-describedby': 'dropzone-hint' },
    t('dropzone.label'),
  );
  const selected = h('p', { class: 'dropzone-selected', hidden: true });
  const el = h('div', { class: 'dropzone' }, iconEl, button, hint, selected, input);

  const api: Dropzone = {
    el,
    setFile(file) {
      if (file) {
        selected.hidden = false;
        selected.textContent = t('dropzone.selected', {
          name: file.name,
          size: formatBytes(file.size),
        });
        button.textContent = t('dropzone.replace');
      } else {
        selected.hidden = true;
        button.textContent = t('dropzone.label');
        input.value = '';
      }
    },
    onFile: () => {},
  };

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) api.onFile(file);
  });

  for (const ev of ['dragenter', 'dragover'] as const) {
    el.addEventListener(ev, (e) => {
      e.preventDefault();
      el.classList.add('is-dragover');
    });
  }
  for (const ev of ['dragleave', 'drop'] as const) {
    el.addEventListener(ev, (e) => {
      e.preventDefault();
      el.classList.remove('is-dragover');
    });
  }
  el.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) api.onFile(file);
  });

  return api;
}
