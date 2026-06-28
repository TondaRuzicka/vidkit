# VidKit — SEO Plan

_Last updated: 2026-06-26 · Domain: https://vidkit.eu · Stack: static Vite + vanilla TS on Cloudflare Pages_

## Context

VidKit is a suite of free, **client-side** (no-upload) browser video tools, monetized
later via SEO-acquired traffic. SEO is the entire acquisition channel, so the site
already follows a "one indexable landing page per search query" model. The build
system makes this cheap: a new tool page is a `PAGES` entry in [src/config.ts](src/config.ts) +
a content JSON per locale + a directory `index.html` — no new code. The processing
engine already handles **any input ffmpeg can decode** into 7 output formats
(mp4, mov, mkv, webm, m4a, mp3, gif), so most of the converter long-tail is buildable
**today with zero engine work**.

The plan below has two thrusts:
1. **Technical SEO hardening** — close gaps that cost rankings/CTR across all pages at once.
2. **Page expansion** — exploit the template system to capture the converter/compressor long tail.

The hard constraint from [CLAUDE.md](CLAUDE.md) governs everything: **no file bytes/metadata
ever leave the device, no consent-triggering cookies, no unapproved third-party scripts.**
That rules out conventional analytics/heatmaps; measurement uses Google Search Console
(crawl-based, no on-site script) plus optional cookieless server-side log analysis.

---

## Current state (baseline)

**Live:** 13 page definitions × {en, cs} = 26 URLs.
- Compress: general, to-25MB, to-10MB, for-WhatsApp
- Convert: MOV→MP4, WebM→MP4, MKV→MP4, AVI→MP4, MP4→WebM, MP4→MP3, MP4→GIF
- Home (en + cs)

**Already done well** (don't rebuild these):
- Per-page `title` / `meta description` / `canonical`, locale-aware — [vite-plugin-pages.ts:55](vite-plugin-pages.ts)
- `hreflang` alternates + `x-default` on every page
- `FAQPage` JSON-LD auto-extracted from visible FAQ markup (can't drift) — [vite-plugin-pages.ts:94](vite-plugin-pages.ts)
- Auto-generated `sitemap.xml` + `robots.txt` from the `PAGES` registry
- Static, JS-disabled-crawlable H1 + prose + FAQ; `<noscript>` fallback
- Header/footer/homepage internal linking; 301 redirects for legacy slugs — [public/_redirects](public/_redirects)
- Lazy-loaded ffmpeg.wasm (never on page load), 1-year immutable asset caching — [public/_headers](public/_headers)

**Gaps to close** (the actionable list):
- ❌ No `og:image` and no Twitter Card tags → weak social/Slack/Discord/iMessage CTR
- ❌ No `SoftwareApplication`/`WebApplication` schema → missing rich-result eligibility
- ❌ No `BreadcrumbList` schema
- ❌ Sitemap has `<loc>` only — no `lastmod`, no `xhtml:link` hreflang alternates
- ❌ Footer omits MKV→MP4 and AVI→MP4 (orphan-ish: only reachable from home grid) — [partials/footer.html](partials/footer.html)
- ❌ No category **hub pages** (`/convert-video/`, `/video-tools/`) → flat link graph, no topical clustering
- ❌ Thin keyword coverage vs. engine capability — ~7 converters live, ~30+ buildable today

---

## Keyword data — DataForSEO, Czechia (location 2203), June 2026

Pulled real Google Ads search volume + organic Keyword Difficulty (KD, 0–100, US/global
reference) for ~150 terms. Three findings **reshape the roadmap** — these supersede the
estimate-based tiers in Phases 2/4 below.

**1. Czech users search in English. Decisively.** In Czechia:
- `mp4 to mp3` = **6,600** vs `mp4 na mp3` = 110 vs `převést mp4 na mp3` = **0**
- `mov to mp4` = **1,900** vs `mov na mp4` = 30 vs `převést mov na mp4` = **0**
- Every Czech *size/platform* term returned **0** (`zmenšit video na 25 mb`, `…pro whatsapp`, `…pro discord`).

→ **English-first.** The English root pages are the asset — they serve Czech users *and* the
global market (where these volumes are 10–50× higher). **Stop expanding Czech converter slugs;**
they target near-zero demand. Keep Czech only where it has real volume: compress terms
(`zmenšení videa` 320, `komprese videa` 170, `jak zmenšit video` 140) — and even those are small.

**2. Audio extraction is the biggest under-served cluster** — huge aggregate volume, near-zero
difficulty, mostly buildable today. The site has **one** page for it (`mp4-to-mp3`). Aggregate CZ
volume across the cluster is ~13k/mo (×global multiplier). This is the #1 expansion.

**3. Size/platform compress pages are low-demand** (`compress video to 25mb` = 10, `…for discord`
= 20, `…for whatsapp` = 10). The existing `cv25`/`cv10`/`cvwa` are cheap to keep but should **not**
be hero content, and **don't build more platform variants** (telegram/email/instagram all ≤10).

> `youtube to mp3` = 40,500 (the single biggest term) is **deliberately out of scope** — VidKit
> can't download YouTube client-side, and it's a ToS/legal minefield. Excluded on purpose.

### Opportunity ranking (CZ volume ÷ difficulty; "feasible today" = no engine work)

| Keyword | CZ vol | KD | Page? | Feasible today? | Action |
|---|---:|---:|---|---|---|
| mp4 to mp3 | 6,600 | 6 | ✅ have | — | keep; make it the audio hub's anchor |
| **m4a to mp3** | 1,900 | 8 | NEW | ✅ (audio in) | **build — top win** |
| **wav to mp3** | 1,300 | 4 | NEW | ✅ (audio in) | **build — top win** |
| **mov to mp3** | 480 | 0 | NEW | ✅ | **build** |
| **mp4 to mov** | 320 | 0 | NEW | ✅ (mov output exists) | **build — trivial** |
| **mkv to mp3** | 170 | 0 | NEW | ✅ | build |
| **webm to mp3** | 110 | 0 | NEW | ✅ | build |
| **mp4 to mkv** | 90 | 0 | NEW | ✅ (mkv output exists) | build |
| **wmv to mp4** | 140 | 4 | NEW | ✅ | build |
| **vob to mp4** | 90 | 0 | NEW | ✅ | build |
| extract audio from video | 260 | 19 | NEW | ✅ | build (audio hub page) |
| video to mp3 | 1,900 | 44 | 301 only | ✅ | promote 301 → real page |
| mov to gif / webm to gif | 210 / 90 | 14 / 11 | NEW | ✅ | build |
| video to gif | 1,600 | 47 | 301 only | ✅ | promote 301 → real page |
| **mp4 to wav** | 390 | 0 | NEW | ⚠️ needs wav output | engine: add wav, then build |
| **mp4 to avi** | 320 | 0 | NEW | ⚠️ needs avi output | engine: add avi, then build |
| **gif to mp4** | 480 | 13 | NEW | ⚠️ needs gif decode | engine: verify gif input, then build |
| shrink video / video converter | 1,000 / 1,300 | 46 | NEW | ✅ | hub/alt-term pages (moderate KD) |
| gif maker / make a gif | 5,400 ea | 72 | NEW | ⚠️ partial fit | high vol but hard + broad intent — later |
| cut / crop / trim video | 320 / 260 / 140 | 47 / 32 / 46 | NEW | ❌ new feature | **new product line** (see Phase 4b) |

Anything KD ≤ 15 with volume is a near-term win regardless of locale. The whole `*-to-mp4`
input long-tail (`avi`/`webm`/`wmv`/`vob`/`flv`/`ts`/`3gp`/`m4v`) sits at **KD 0–5** — cheap to own.

### SERP reality (DataForSEO SERP, Czechia) + free-tool validation

The data above was cross-checked against live CZ SERPs, Google autocomplete (`hl=cs&gl=cz`), and
Google Trends (geo=CZ). All four signals agree. Key competitive takeaways:

- **English converter SERPs in CZ are owned by global giants** — `cloudconvert`, `freeconvert`,
  `happyscribe`, `convertio`, `zamzar`, `clideo`, plus Adobe Express / Canva / tinywow. `prevod-souboru.cz`
  (the Czech hub) does **not** rank for English queries — it only wins Czech-language terms (low volume).
- **The "no upload / no watermark" angle is already partially claimed** by some competitors
  (`vidshift.io` ranks #5 for *compress video* on "No Upload"; `rendley.com` leads on "No Watermark").
  So it's **not unclaimed** — VidKit must go further than the slogan: *provably* client-side (verifiable
  in the Network tab), **no size limit, no queue, no file deleted-later** because nothing was uploaded.
- **Softer SERPs = better near-term targets.** `compress video` and `mp4-to-mov` SERPs are fragmented
  (small players like `videocompress.ai`, `compress.addy.ie`, `mov.to`, `groupdocs.app` rank alongside
  the giants) — more winnable than `mp4-to-mp3`, which faces a cloudconvert/zamzar/clideo wall.
- **Informational results rank** (Microsoft/Apple support forums for "how to convert…") → strong FAQ +
  HowTo schema content can capture intent the pure tool pages miss.

**Czech-language opportunity is HOW-TO content, not landing pages.** Autocomplete for Czech seeds
returns informational/device queries, never tool-keywords: `jak zmenšit video do emailu`, `jak převést
video na zvuk`, `komprese videa bez ztráty kvality`, `…iphone`, `…v mobilu`. → If pursuing Czech
traffic, build **guide/blog content** ("Jak zmenšit video pro e-mail", device-specific how-tos), not
more `cs` converter slugs. Transactional CZ converter traffic is English and served by the root pages.

**Off-scope, by design:** the largest adjacent demand is `youtube to mp3/mp4` (368k–550k) and
`tiktok/instagram to mp4` (40k–60k). These require downloading from a platform — impossible client-side
and a ToS/legal minefield. Document why they're excluded so the boundary is a deliberate, defensible
choice, not an oversight. `handbrake video compressor` (40k) is a fair **positioning** comparison
("a free, no-install alternative to Handbrake"), not a page to build.

## Phase 1 — Technical SEO hardening (do first; site-wide leverage)

These are mostly edits to [vite-plugin-pages.ts](vite-plugin-pages.ts) `metaBlock()` and the content JSONs, so
every existing and future page benefits automatically.

1. **Open Graph + Twitter images.** Add `og:image`, `og:image:width/height`, `twitter:card=summary_large_image`,
   `twitter:title/description/image` to `metaBlock()`. Generate one static branded 1200×630 PNG
   per page _category_ (compress / convert / home) — not per page — and place under `public/og/`.
   Optionally template the output format into the convert image filename. Keep it static (no dynamic
   image service — that would add a server dependency the project forbids).
2. **`SoftwareApplication` JSON-LD.** Emit per page from a new helper alongside `faqJsonLd()`:
   `@type: SoftwareApplication`, `applicationCategory: MultimediaApplication`,
   `operatingSystem: Any (browser-based)`, `offers: { price: 0 }`, `featureList`, `browserRequirements`.
   This is honest (it's a free web app) and unlocks rich results. Drive the name/description from the
   page's existing `meta.*` keys so it stays in sync.
3. **`BreadcrumbList` JSON-LD** once hub pages exist (Phase 3): Home → Category → Tool.
4. **Sitemap upgrades** in [vite-plugin-pages.ts:152](vite-plugin-pages.ts) `sitemap()`:
   - Add `<lastmod>` (use the content file's mtime, or a build timestamp passed via build env — do **not**
     call `Date.now()` at module load).
   - Add `<xhtml:link rel="alternate" hreflang="…">` entries per URL so Google sees the en/cs pairing
     in the sitemap as well as in `<head>`.
5. **Footer completeness.** Add MKV→MP4 and AVI→MP4 to the convert column in [partials/footer.html](partials/footer.html)
   so no live page is reachable only from the homepage grid.
6. **Validate** post-build: Rich Results Test on one compress + one convert page; confirm
   `SoftwareApplication` + `FAQPage` both parse; re-confirm Lighthouse SEO ≥ 95 / Perf ≥ 90 / A11y ≥ 90
   (the [CLAUDE.md](CLAUDE.md) definition-of-done bar) using the `preview_*` tools on the built `dist/`.

---

## Phase 2 — Converter long-tail expansion (highest ROI; pure content)

The engine converts **any decodable input → {mp4, mov, mkv, webm, m4a, mp3, gif}** with no new code
(verified in [src/core/formats.ts](src/core/formats.ts) + [src/engines/ffmpeg.ts](src/engines/ffmpeg.ts)). Each new page = `PAGES` entry +
`content/<id>.{en,cs}.json` + directory `index.html` + `vite.config.ts` input entry. Ship in batches;
write **real, specific copy + 3 FAQs** per page (no placeholders — [CLAUDE.md](CLAUDE.md) rule).

> **Order is now set by the keyword-data table above, not the original A/B/C tiers.** Build
> **English pages first** (Czech converter slugs are near-zero demand). Real priority order:
> **(1) Audio-extraction cluster** — `m4a-to-mp3`, `wav-to-mp3`, `mov-to-mp3`, `mkv-to-mp3`,
> `webm-to-mp3`, `extract-audio-from-video`, promote `video-to-mp3` (all KD ≤ 19, feasible today);
> **(2) Trivial convert pairs** — `mp4-to-mov`, `mp4-to-mkv` (outputs already exist, KD 0);
> **(3) `*-to-mp4` input long-tail** — `wmv`, `vob`, `flv`, `ts`, `3gp`, `m4v` (KD 0–5);
> **(4) GIF pairs** — `mov-to-gif`, `webm-to-gif`, promote `video-to-gif`.
> Then the engine-gated trio (`mp4-to-wav`, `mp4-to-avi`, `gif-to-mp4`) once those outputs/inputs land.

**Tier A — high-demand "X to MP4" inputs (ship next):** these match the existing MOV/WebM/AVI/MKV
pattern and have strong search volume.
- `flv-to-mp4`, `wmv-to-mp4`, `m4v-to-mp4`, `3gp-to-mp4`, `mts-to-mp4` (camcorder), `ts-to-mp4`, `ogv-to-mp4`

**Tier B — "MP4 to X" + reverse pairs (strong demand):**
- `mp4-to-mov`, `mp4-to-mkv`, `mp4-to-avi`*, `mp4-to-m4a`
- `webm-to-gif`, `mov-to-gif`, `gif-to-mp4`*, `video-to-gif` (already 301'd → keep or promote to real page)

**Tier C — audio extraction cluster (own search intent, all feasible):**
- `mov-to-mp3`, `webm-to-mp3`, `mkv-to-mp3`, `avi-to-mp3`, `m4a-to-mp3`, `wav-to-mp3`
- `mp4-to-wav`*, `mp4-to-m4a`, `video-to-mp3` (already 301'd → promote to real page)

\* **Engine check before building:** `avi`, `wav` as _outputs_ and reliable `gif→video` decode are
**not** confirmed in the current `FORMATS` map (only the 7 listed outputs exist). For each starred page,
either (a) drop it, or (b) add the output format to [src/core/formats.ts](src/core/formats.ts) first and verify a real
conversion end-to-end. **Never ship a landing page the widget can't fulfill** — a tool page that errors
on its core promise is worse than no page.

**Per-page checklist (keeps quality high, avoids thin/doorway pages):**
- Unique `meta.title`/`meta.description`/`og.*`, H1, 80–120-word intro targeting the exact query
- A "why convert X to Y" prose block with format-specific detail (not boilerplate swapped by find/replace)
- 3 genuinely format-specific FAQs (feeds `FAQPage` schema automatically)
- Localized en + cs slug + content; add to footer/hub internal links
- Confirm the conversion actually runs in the preview before merging

---

## Phase 3 — Hub pages & internal-link clusters (topical authority)

A flat 26→60-page site needs hubs so link equity and crawl flow into the spokes and Google sees
coherent topics.

1. **`/video-tools/`** — top hub listing every tool, grouped (Compress / Convert to MP4 / Convert from MP4 / Extract audio / GIF). Link from header + footer + homepage.
2. **`/convert-video/`** — converter hub; links every X→Y page, grouped by direction.
3. **`/compress-video/`** already exists — make it double as the compress hub: add a "compress for…"
   sub-grid linking the size/platform variants.
4. **"Related tools" block on every tool page** — e.g. MOV→MP4 links MOV→MP3, MOV→GIF, MKV→MP4,
   compress-video. Drive it from a small per-page related-ids list in content, rendered by the template.
5. Add `BreadcrumbList` JSON-LD (Phase 1 item 3) now that the hierarchy exists.

These hubs are also where future **platform/size compress pages** plug in.

---

## Phase 4 — Compress variants (DEPRIORITIZED by data) + new editing tools

**4a — Compress variants: mostly cut.** The keyword data killed the platform/size thesis —
`compress video for discord` = 20, `…for whatsapp` = 10, `…to 25mb` = 10 (CZ). **Do not build
the discord/telegram/email/instagram pages.** Keep existing `cv25`/`cv10`/`cvwa`. The only compress
terms worth a dedicated page are generic alternates with real volume:
`shrink-video` (1,000 / KD 46), `compress-mp4` (390 / KD 31), `video-compressor` (1,000 / KD 72 — hard).

**4b — New product line: lightweight client-side editing.** The data surfaced demand the site
can't serve yet: `cut video online` (320), `crop video online` (260), `trim video online` (140),
`resize video` (90), `rotate video online` (50), `merge videos online` (30). KD 32–47 (rankable).
These need **new engine work** (trim/crop/rotate via WebCodecs or ffmpeg), but they fit the privacy
moat perfectly — "edit your video without uploading it" is the same story that wins converters.
Start with trim/cut (highest-volume editing intent, natural companion to compression). Scope as its
own milestone (engine + UI + landing pages), not a content-only batch.

---

## Phase 5 — Localization scale-out

The i18n system is built and proven (en/cs). Growth lever once en converts:
- Add locales by adding to `LOCALES` in [src/config.ts](src/config.ts) + a content JSON set per page. German,
  Spanish, French, Portuguese, Polish are high-volume for these queries.
- **Gate on quality:** machine-translated copy with no native review reads as spam to both users and
  Google. Translate the cs set's proven copy; don't bulk-auto-translate 60 pages × 6 languages blind.
- hreflang/x-default and localized slugs already handle the URL + signaling layer automatically.

---

## Build order — concrete first batches (validated, ship in this sequence)

**Decision: new converter pages are English-only** (`locales: ['en']`). The CZ data shows Czech
converter slugs ≈ 0 volume, and English root pages serve both Czech and global searchers. The
existing `cs` pages stay; we just don't add Czech twins for new converters. (Czech effort instead
goes to how-to content — separate track, not in this build order.)

**Per-page recipe (4 small files, no engine work — copy an existing convert page):**
1. `content/<id>.en.json` — the 17 keys from [content/mp42mp3.en.json](content/mp42mp3.en.json) (meta/og/hero/`convert.format`/prose/3×faq).
   Write **real input-specific copy** — never find/replace a format name (thin-content risk, [CLAUDE.md](CLAUDE.md)).
2. `src/config.ts` `PAGES` — `{ id:'<id>', template:'convert', locales:['en'], slugs:{ en:'<slug>' } }`
   (cs slug can be omitted when locale list is en-only). See [src/config.ts:51](src/config.ts).
3. `<slug>/index.html` — the 12-line stub from [mp4-to-mp3/index.html](mp4-to-mp3/index.html), swapping the id in
   `@meta`/`@render`.
4. `vite.config.ts` — add `'<id>': '<slug>/index.html'` to `rollupOptions.input` (quote keys that
   start with a digit, e.g. `'3gp2mp4'`).

`convert.format` is always the **output**; the input is copy framing only (the widget accepts any
decodable input). So every audio page = `mp3`, every `*-to-mp4` page = `mp4`, etc.

### Batch 1 — Audio extraction
> **Verification finding (2026-06-26):** the engine originally rejected **audio-only inputs** (`probe()`
> threw `notVideo` with no video track; the ffmpeg fallback also required a video stream). **Fixed** —
> `probe`/`ffmpegProbe`/`buildPlan`/`engineSelect` now accept audio-only files (see "Audio-only input
> support" under Batch 4, now done). Verified end-to-end in real Chrome: an audio-only `.m4a` converts
> to a valid `.mp3` (ID3 header, `audio/mpeg`, FFmpeg engine), no console errors; 32 unit tests pass.

| id | slug | convert.format | CZ vol | KD | status |
|---|---|---|---:|---:|---|
| mov2mp3 | mov-to-mp3 | mp3 | 480 | 0 | ✅ **shipped** (template) |
| m4a2mp3 | m4a-to-mp3 | mp3 | 1,900 | 8 | ✅ **shipped** (live-verified) |
| wav2mp3 | wav-to-mp3 | mp3 | 1,300 | 4 | ✅ **shipped** |
| mkv2mp3 | mkv-to-mp3 | mp3 | 170 | 0 | ✅ **shipped** |
| webm2mp3 | webm-to-mp3 | mp3 | 110 | 0 | ✅ **shipped** |
| video2mp3 | video-to-mp3 | mp3 | 1,900 | 44 | ✅ **shipped** (301 → real page; redirect removed) |
| extractaudio | extract-audio-from-video | mp3 | 260 | 19 | ✅ **shipped** (audio hub) |

**Batch 1 complete (2026-06-26):** all 8 audio-extraction pages live (7 new + existing `mp4-to-mp3`),
English-only, build-clean, in sitemap. Audio-only-input engine support landed + live-verified.
**Internal linking done:** a 5th footer column "Extract audio" (global, all pages incl. cs) + a homepage
"Extract audio" section link the whole cluster. Dedicated `/video-tools/` + `/convert-video/` hub pages
(Phase 3) still pending. Committed on branch `seo/audio-extraction-pages`.

### Batch 2 — Trivial pairs + input long-tail (no engine work; all KD ≤ 6)
| id | slug | convert.format | CZ vol | KD |
|---|---|---|---:|---:|
| mp42mov | mp4-to-mov | mov | 320 | 0 |
| mp42mkv | mp4-to-mkv | mkv | 90 | 0 |
| wmv2mp4 | wmv-to-mp4 | mp4 | 140 | 4 |
| vob2mp4 | vob-to-mp4 | mp4 | 90 | 0 |
| flv2mp4 | flv-to-mp4 | mp4 | 70 | 6 |
| ts2mp4 | ts-to-mp4 | mp4 | 50 | — |
| 3gp2mp4 | 3gp-to-mp4 | mp4 | 40 | 5 |
| m4v2mp4 | m4v-to-mp4 | mp4 | 30 | 0 |

### Batch 3 — GIF pairs (no engine work)
| id | slug | convert.format | CZ vol | KD | note |
|---|---|---|---:|---:|---|
| video2gif | video-to-gif | gif | 1,600 | 47 | **promote** — delete `/video-to-gif/ … 301` in [public/_redirects](public/_redirects):10 |
| mov2gif | mov-to-gif | gif | 210 | 14 | |
| webm2gif | webm-to-gif | gif | 90 | 11 | |

### Batch 4 — Engine-gated (do the core change, then the page)

**Audio-only input support — ✅ DONE (2026-06-26), unlocked m4a-to-mp3 + wav-to-mp3 (3,200 vol).**
Implemented: `ProbeResult.video` made nullable ([src/core/types.ts](src/core/types.ts)); `probe()` returns an audio-only
result when there's an audio track but no video ([src/core/probe.ts](src/core/probe.ts)); `ffmpegProbe()` accepts
audio-only ([src/engines/ffmpeg.ts](src/engines/ffmpeg.ts)); `buildPlan()` guards non-audio modes with `notVideo`
([src/core/targetSize.ts](src/core/targetSize.ts)); `engineSelect()` routes audio-only to ffmpeg; the two progress denominators
([src/workers/compress.worker.ts](src/workers/compress.worker.ts), [src/ui/widget.ts](src/ui/widget.ts)) fall back to a duration estimate. 2 new unit
tests added; 32 pass. Live-verified m4a→mp3 in real Chrome.

**New output formats** — need a `src/core/formats.ts` change first:
- **mp4-to-wav** (390 / KD 0) — add `'wav'` to `FormatId` + `container` unions, a PCM option to the
  `audioCodec` union (`pcm`), a `FORMATS.wav` entry (`kind:'audio'`, `engine:'ffmpeg'`), and `-c:a
  pcm_s16le` args in [src/engines/ffmpeg.ts](src/engines/ffmpeg.ts). PCM bitrate isn't user-selectable — bypass the audio-bitrate UI.
- **mp4-to-avi** (320 / KD 0) — add `'avi'` format (H.264-in-AVI or mpeg4) + ffmpeg muxer args. Test
  playback; AVI muxing is fussier than the others.
- **gif-to-mp4** (480 / KD 13) — output `mp4` already exists; this is **input** work: verify GIF
  decodes through the ffmpeg-fallback probe path and add `.gif` to the dropzone `accept` in
  [src/ui/dropzone.ts](src/ui/dropzone.ts). Likely a verify-and-ship, not a real engine change — check first.

### Internal linking (do alongside, not after)
Add each shipped page to the footer convert column ([partials/footer.html](partials/footer.html)) and group them under the
`/video-tools/` + `/convert-video/` hubs (Phase 3) so new pages aren't orphaned from the homepage grid.

### Verification per page (before merge)
Use the `preview_*` tools on the built page: drop a **small** real sample of the input format,
confirm (1) the output downloads and plays/opens, (2) zero console errors / no unhandled rejection,
(3) the `FAQPage` JSON-LD renders, (4) Lighthouse SEO ≥ 95. Test **big** files in real Chrome, not the
embedded preview (it crashes on GB-scale blobs). Audio-only inputs (m4a/wav) are the main risk — verify
the probe accepts them before writing the rest of Batch 1.

---

## Measurement & guardrails

- **Google Search Console** is the primary instrument — crawl/impression/click/position data with **no
  on-site script**, fully compatible with the privacy promise. Submit `sitemap.xml`; track which
  converter/compressor queries surface, and let real impression data **re-prioritize Phase 2/4 tiers**
  (the tiers above are demand-estimates, not measured).
- **Optional cookieless analytics:** if any on-site measurement is added later, it must send **zero
  file-related data** and use no consent-triggering storage ([CLAUDE.md](CLAUDE.md) hard rule). Prefer
  Cloudflare's server-side Web Analytics (no cookie) over any JS that fingerprints.
- **Privacy claim is a ranking asset, not just legal copy** — lean into it in titles/descriptions
  ("no upload", "files never leave your device", "no sign-up, no watermark"); it's the genuine
  differentiator vs. CloudConvert/Veed/Clideo and drives CTR.
- **Anti-thin-content discipline:** every page must do its job in the browser and carry unique copy.
  Volume of pages is the strategy, but a doorway page that errors or reads as templated boilerplate
  invites a manual action. Quality gate each batch.

## Suggested execution order

1. **Phase 1** (technical hardening) — one PR, site-wide lift, unblocks rich results.
2. **Phase 2 Tier A** (X→MP4) — first content batch, proves the expansion cadence.
3. **Phase 3** hubs + related-tools — before the page count balloons, so new pages slot into a structure.
4. **Phase 2 Tier B/C** + **Phase 4** — driven by GSC data from the first batches.
5. **Phase 5** — after en demand is validated.
