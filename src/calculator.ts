import { calcBitrate, type Verdict } from './core/bitrate.ts';
import { t } from './ui/i18n.ts';

// Standalone entry for the /video-bitrate-calculator/ page. Deliberately does
// NOT import the compressor widget or its engine — the page stays a few KB of
// JS. Reads plain form controls, writes the result live. Without JS the form is
// inert and a <noscript> line explains the static numbers still apply.

const root = document.getElementById('bitrate-calc');
if (root) {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const sizeMb = $<HTMLInputElement>('input[name="size-mb"]');
  const durMin = $<HTMLInputElement>('input[name="dur-min"]');
  const durSec = $<HTMLInputElement>('input[name="dur-sec"]');
  const audio = $<HTMLSelectElement>('select[name="audio-kbps"]');
  const fps = $<HTMLSelectElement>('select[name="fps"]');

  const result = $<HTMLElement>('.calc-result');
  const outVideo = $<HTMLElement>('[data-out="video"]');
  const outTotal = $<HTMLElement>('[data-out="total"]');
  const outVerdict = $<HTMLElement>('[data-out="verdict"]');
  const cta = $<HTMLAnchorElement>('[data-out="cta"]');

  // Locale-correct compressor URLs handed in by the template.
  const urls: Record<number, string> = {
    10: root.dataset.urlCv10 ?? '/compress-video-to-10mb/',
    25: root.dataset.urlCv25 ?? '/compress-video-to-25mb/',
  };
  const urlGeneric = root.dataset.urlCv ?? '/compress-video/';

  const num = (el: HTMLInputElement) => {
    const n = Number.parseFloat(el.value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const fmtRate = (bps: number): string => {
    if (bps <= 0) return '—';
    const kbps = bps / 1000;
    if (kbps < 1000) return t('calc.unit.kbps', { n: Math.round(kbps) });
    const mbps = kbps / 1000;
    return t('calc.unit.mbps', { n: mbps.toFixed(mbps < 10 ? 2 : 1) });
  };

  const verdictText = (
    v: Verdict,
    res: string | null,
    fpsVal: number,
  ): string => {
    switch (v) {
      case 'ok':
        return t('calc.verdict.ok', { res: res!, fps: fpsVal });
      case 'soft':
        return t('calc.verdict.soft');
      case 'tight':
        return t('calc.verdict.tight');
      case 'tooSmall':
        return t('calc.verdict.tooSmall');
    }
  };

  const recompute = () => {
    const mb = num(sizeMb);
    const durationS = num(durMin) * 60 + Math.min(num(durSec), 59);
    const fpsVal = Number.parseInt(fps.value, 10) || 30;
    const audioBps = (Number.parseInt(audio.value, 10) || 0) * 1000;

    const r = calcBitrate({ targetBytes: mb * 1_000_000, durationS, audioBps, fps: fpsVal });

    outVideo.textContent = fmtRate(r.videoBps);
    outTotal.textContent = fmtRate(r.totalBps);
    outVerdict.textContent = verdictText(r.verdict, r.recommendedRes, fpsVal);
    outVerdict.dataset.verdict = r.verdict;

    const rounded = Math.round(mb);
    cta.href = urls[rounded] ?? urlGeneric;
    cta.textContent =
      mb > 0 ? t('calc.cta', { mb: rounded }) : t('calc.cta.generic');

    result.hidden = false;
  };

  for (const el of [sizeMb, durMin, durSec, audio, fps]) {
    el.addEventListener('input', recompute);
  }
  recompute();
}
