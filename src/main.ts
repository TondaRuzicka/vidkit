import './styles/widget.css';

const mount = document.getElementById('compressor');

if (mount) {
  const targetMb = mount.dataset.targetMb
    ? Number(mount.dataset.targetMb)
    : null;
  const locked = mount.dataset.locked === 'true';
  // Widget UI lands in a later phase; for now record the page config so the
  // spike harness can use it.
  mount.dataset.ready = 'true';
  void targetMb;
  void locked;
}
