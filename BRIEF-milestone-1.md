# Brief — Milestone 1: Video compressor with target-size mode

Read CLAUDE.md first. It defines the stack, conventions, and hard rules.
This brief defines only what to build now.

## Goal

Ship the flagship tool: a video compressor that runs entirely in the
browser and can hit an **exact target file size** ("make this video
fit under 25 MB"). This targets queries like "compress video to 25mb",
"compress video for discord", "video compressor online no upload".

## User story

A user has a video that's too big for Discord / email / WhatsApp. They
land on the page, drop the file in, pick a target (or it's pre-selected
based on which landing page they came from), click Compress, watch
progress, preview the result next to the original, and download. Total
interaction: under 5 clicks. No sign-up, no upload wait, no watermark.

## Scope

### Pages (static HTML, each with unique SEO copy)

1. `/compress-video/` — generic compressor, full controls.
2. `/compress-video-to-25mb/` — same widget, preset locked to 25 MB,
   copy targeting Discord Nitro + Gmail/Outlook attachment limits.
3. `/compress-video-to-10mb/` — preset 10 MB, copy targeting Discord
   free tier.
4. `/compress-video-for-whatsapp/` — preset 16 MB, WhatsApp copy.
5. `/` — homepage: one-paragraph pitch, grid linking to the tools,
   short "why files never leave your device" explainer.

Each tool page includes: h1 matching the query intent, ~300 words of
genuinely useful copy (how it works, why client-side matters, what
quality to expect), and an FAQ section (4–6 questions) marked up with
FAQPage schema.org JSON-LD.

### The compressor widget

- Input: drag-and-drop + file picker. Accept video/* ; support at
  minimum MP4 (H.264/H.265), MOV, WebM, MKV, AVI inputs.
- Modes:
  - **Target size** (primary): user picks 8 / 10 / 16 / 25 / 50 MB or
    enters a custom number. Implement two-pass logic: compute video
    bitrate budget from duration minus audio budget; downscale
    resolution and/or cap fps automatically when the budget per pixel
    falls below a usable threshold. Output must come in UNDER the
    target — never over. Within 10% under target is the quality bar.
  - **Quality mode** (secondary): high / medium / low presets.
- Output: MP4 (H.264 + AAC) only in this milestone.
- Engine selection: WebCodecs when available for decode+encode;
  lazy-load ffmpeg.wasm only when the input codec or browser requires
  it. Show which engine is in use in a subtle status line (useful for
  debugging and builds trust).
- Progress: real progress bar (frames processed / total), estimated
  time remaining after the first 10% of frames, cancel button that
  actually frees memory.
- Result screen: original vs compressed size, percentage saved, and a
  side-by-side (or A/B slider) video preview before download.
- Large-file handling: must process a 2 GB input without crashing the
  tab. Stream/chunk where the engine allows; never hold both full
  input and full output in memory simultaneously if avoidable.
- All processing in a Web Worker — the UI thread never jank-freezes.

### Explicitly OUT of scope for this milestone

- Batch processing, other output formats, trimming/cropping, audio
  tools, premium tier, ads, analytics, i18n locales beyond English,
  dark mode. Do not build these. List them as suggestions if relevant.

## Acceptance criteria (verify each before declaring done)

1. A 200 MB 1080p H.264 MP4 compresses to under 25 MB on a mid-range
   laptop in Chrome via WebCodecs, without tab crash, in a reasonable
   time (target: faster than real-time playback duration).
2. The same file in Safari (or with an H.265 input in Firefox) falls
   back to ffmpeg.wasm and completes correctly.
3. Target-size mode output is ≤ target on 5 test videos of varied
   duration (10 s to 20 min) — never over.
4. A 2 GB input either completes or fails gracefully with a clear
   message — never a frozen tab or silent crash.
5. DevTools Network tab shows zero requests containing file data
   during the entire compress flow.
6. All five pages pass the Lighthouse bars defined in CLAUDE.md.
7. Keyboard-only operation works end to end; the dropzone and all
   controls are reachable and labeled (a11y).

## Deliverables

- Working code, `npm run build` → deployable `dist/`.
- A short TESTING.md: which sample files you tested, on which engine,
  with resulting sizes/times.
- A list of follow-up suggestions (max 10 lines) for milestone 2.
