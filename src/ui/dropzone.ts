import { formatBytes, h } from './dom';
import { t } from './i18n';

export interface Dropzone {
  el: HTMLElement;
  /** Show the picked file (or reset with null). */
  setFile(file: File | null): void;
  onFile: (file: File) => void;
}

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
  const hint = h('p', { class: 'dropzone-hint', id: 'dropzone-hint' }, t('dropzone.hint'));
  const label = h('span', { class: 'dropzone-label' }, t('dropzone.label'));
  const button = h(
    'button',
    { type: 'button', class: 'dropzone-button', 'aria-describedby': 'dropzone-hint' },
    label,
  );
  const selected = h('p', { class: 'dropzone-selected', hidden: true });
  const el = h('div', { class: 'dropzone' }, button, hint, selected, input);

  const api: Dropzone = {
    el,
    setFile(file) {
      if (file) {
        selected.hidden = false;
        selected.textContent = t('dropzone.selected', {
          name: file.name,
          size: formatBytes(file.size),
        });
        label.textContent = t('dropzone.replace');
      } else {
        selected.hidden = true;
        label.textContent = t('dropzone.label');
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
      el.classList.add('dropzone-active');
    });
  }
  for (const ev of ['dragleave', 'drop'] as const) {
    el.addEventListener(ev, (e) => {
      e.preventDefault();
      el.classList.remove('dropzone-active');
    });
  }
  el.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) api.onFile(file);
  });

  return api;
}
