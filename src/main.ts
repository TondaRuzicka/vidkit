import { DEFAULT_FORMAT, isFormatId, type FormatId } from './core/formats';
import './styles/widget.css';
import { mountWidget } from './ui/widget';

const mount = document.getElementById('compressor');

if (mount) {
  const targetMb = Number(mount.dataset.targetMb);
  // data-formats="mp4,mov,mkv" → selectable list; data-locked-format="webm"
  // → fixed output; data-format="mp4" → default selection.
  const choices = (mount.dataset.formats ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isFormatId) as FormatId[];
  const lockedFormat = isFormatId(mount.dataset.lockedFormat)
    ? mount.dataset.lockedFormat
    : null;
  const defaultFormat: FormatId = isFormatId(mount.dataset.format)
    ? mount.dataset.format
    : lockedFormat ?? choices[0] ?? DEFAULT_FORMAT;

  mountWidget(mount, {
    lockedTargetMB:
      mount.dataset.locked === 'true' && Number.isFinite(targetMb) ? targetMb : null,
    defaultTargetMB: Number.isFinite(targetMb) && targetMb > 0 ? targetMb : 25,
    lockedFormat,
    defaultFormat,
    formatChoices: choices.length > 0 ? choices : null,
  });
}
