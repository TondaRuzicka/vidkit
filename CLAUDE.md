# CLAUDE.md — Project context (read this first)

## What this project is

A suite of free, browser-based video tools (working name: TBD). All file
processing happens **client-side** — files never leave the user's device.
The business model is Photopea-style: free tools, acquired via SEO,
monetized later with ads and a premium tier.

This context shapes technical decisions. When in doubt, optimize for:
1. **Privacy claim must stay literally true** — zero file bytes ever sent
   to any server, ever. This is the core marketing promise.
2. **SEO structure** — every tool is its own indexable landing page
   targeting a specific search query.
3. **Near-zero hosting cost** — everything must run as a static site.

## Stack (decided — do not substitute)

- Vanilla TypeScript + Vite. No React/Vue/Svelte. Bundle stays small.
- Styling: plain CSS with custom properties. No Tailwind, no CSS framework.
- Video processing: **WebCodecs API first** (hardware-accelerated),
  **ffmpeg.wasm as fallback** for unsupported codecs/browsers.
  Feature-detect at runtime; never load the ~30MB wasm core unless the
  fallback is actually needed (lazy-load on demand).
- Hosting: Cloudflare Pages (static). No server, no functions, no API
  routes for file processing.
- No backend. No database. No accounts (yet).

## Architecture conventions

- Each tool lives at its own path with its own static HTML entry:
  `/compress-video/`, `/compress-video-to-25mb/`, etc. These are SEO
  landing pages — unique title, meta description, h1, and on-page copy
  per page. Never collapse tools into a client-side-routed SPA with one
  HTML file.
- Shared processing logic lives in `/src/core/` and is imported by all
  tool pages. Tool pages are thin wrappers: UI + copy + a call into core.
- The site must be fully crawlable with JS disabled: headline, copy, FAQ
  content rendered in static HTML. Only the tool widget itself requires JS.
- i18n-ready from day one: all UI strings in `/src/locales/en.json`
  (flat keys, no hardcoded strings in components). Czech and other
  locales will be added at `/cs/compress-video/` etc. — keep URL
  structure and string loading compatible with that, but do NOT build
  the full i18n system in milestone 1.

## Hard rules (never violate)

- Never add any code path that transmits file contents or file metadata
  (names, sizes, hashes) to any remote endpoint. This includes analytics,
  error reporting, and logging. If error reporting is added later, it
  must strip all file-related data.
- No third-party scripts except those explicitly approved in a brief.
- No cookies / localStorage that would require a consent banner in the EU.
- No placeholder text in landing-page copy. If copy is needed, write
  real, specific copy targeting the page's keyword.
- Don't add features outside the current milestone's brief. Suggest them
  at the end of your work instead.

## Definition of done (applies to every milestone)

- Works in latest Chrome, Firefox, Safari (desktop) and Chrome/Safari
  on mobile. Degrades gracefully (clear message) where WebCodecs and
  wasm are both unavailable.
- No console errors. No unhandled promise rejections during normal use.
- Lighthouse (mobile): Performance ≥ 90, SEO ≥ 95, Accessibility ≥ 90
  on every landing page.
- `npm run build` produces a deployable static `dist/` with no warnings.
