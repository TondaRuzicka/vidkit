# Milestone 2 suggestions (from milestone 1 work)

1. `/compress-video-to-8mb/` page — old Discord free limit still gets searches; preset exists.
2. Hybrid audio path: WebCodecs video + low-bitrate AAC via a tiny wasm AAC encoder, so long-video/small-target jobs stay on the fast engine (today they drop to ffmpeg, ~10× slower).
3. COOP/COEP headers + `@ffmpeg/core-mt` to multithread the fallback engine (measure embed impact first).
4. "Send as WhatsApp document" / "trim instead?" smart suggestions when the bpp ladder bottoms out — better than refusing or smearing.
5. Trim-to-fit: let the user cut a range when the target is impossible (the math already knows the max duration that fits).
6. Open-source notices page (ffmpeg.wasm GPL obligation — needs owner sign-off before launch) + brand/domain decision (`src/config.ts`).
7. Quality-mode preview frame (encode 1 s sample, show before committing to a full pass).
8. Persist last-used settings in memory only (no storage → no consent banner) or via URL params for shareable presets.
9. Czech locale pilot: `/cs/` HTML pages + locale-keyed `en.json`/`cs.json` import — the URL structure and `t()` call sites are already compatible.
10. Error telemetry decision: if ever added, must strip all file metadata per CLAUDE.md; consider a privacy-preserving counter (status code only).
