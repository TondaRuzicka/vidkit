import './styles/widget.css';
import { mountWidget } from './ui/widget';

const mount = document.getElementById('compressor');

if (mount) {
  const targetMb = Number(mount.dataset.targetMb);
  mountWidget(mount, {
    lockedTargetMB:
      mount.dataset.locked === 'true' && Number.isFinite(targetMb) ? targetMb : null,
    defaultTargetMB: Number.isFinite(targetMb) && targetMb > 0 ? targetMb : 25,
  });
}
