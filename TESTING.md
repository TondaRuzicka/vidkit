# TESTING — Milestone 1

Test date: 2026-06-12. Machine: Apple Silicon MacBook Pro, macOS 25.5
(Darwin), Chrome (embedded Chromium preview). Fixtures generated with the
ffmpeg CLI into `test-videos/` (untracked); commands below.

## Fixtures

```bash
# duration matrix: 1080p30 H.264 + 128k AAC sine, ~8 Mbps
for d in 10 60 300 900 1200; do
  ffmpeg -f lavfi -i "testsrc2=duration=${d}:size=1920x1080:rate=30" \
         -f lavfi -i "sine=frequency=440:duration=${d}" \
         -c:v libx264 -pix_fmt yuv420p -b:v 8M -c:a aac -b:a 128k -shortest "fixture-${d}s.mp4"
done
# format matrix (from fixture-60s.mp4)
ffmpeg -i fixture-60s.mp4 -c:v mpeg4 -q:v 5 -c:a mp3 fixture.avi
ffmpeg -i fixture-60s.mp4 -c:v libx265 -tag:v hvc1 -preset fast -b:v 4M -c:a copy fixture-h265.mp4
ffmpeg -i fixture-60s.mp4 -c copy fixture.mov
ffmpeg -i fixture-60s.mp4 -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 4M -c:a libopus fixture.webm
ffmpeg -i fixture-60s.mp4 -c copy fixture.mkv
# large files
ffmpeg -f lavfi -i "testsrc2=duration=3600:size=1920x1080:rate=30" -c:v libx264 -preset ultrafast -b:v 4500k -an fixture-2gb.mp4   # 2.03 GB
ffmpeg -i fixture-2gb.mp4 -c copy fixture-2gb.avi                                                                                  # 2.08 GB
```

## Target-size mode (AC 3) — output must be ≤ target, never over

| Fixture | Target | Engine | Output | % of target | Output dims | Wall time |
|---|---|---|---|---|---|---|
| 10 s (10.5 MB) | 8 MB | WebCodecs | 7.55 MB | 94% | 1920x1080@30 | 1.4 s |
| 10 s (10.5 MB) | 25 MB | WebCodecs | 10.95 MB¹ | 44% | 1920x1080@30 | 1.2 s |
| 60 s (61 MB) | 8 MB | WebCodecs | 7.35 MB | 92% | 864x486@30 | 4.6 s |
| 60 s (61 MB) | 25 MB | WebCodecs | 24.23 MB | 97% | 1920x1080@30 | 6.6 s |
| 300 s (305 MB) | 8 MB | WebCodecs | 6.86 MB | 86% | 320x180@30 | 19.3 s |
| 300 s (305 MB) | 25 MB | WebCodecs | 23.19 MB | 93% | 720x406@30 | 18.4 s |
| 900 s (915 MB) | 25 MB | WebCodecs | 21.6 MB | 86% | 320x180@30 | 59.4 s |
| 1200 s (1.22 GB) | 25 MB | WebCodecs | 20.9 MB | 84% | 320x180@20 | ~80 s |

¹ Already-under-target case: bitrate is capped at the source's so the
"compressed" file can't come out bigger; the widget also shows an
"already under target" notice before starting.

Every run landed under target on attempt 1 (verify-retry loop never needed
a second pass with these hardware encoders; the loop exists for encoders
that overshoot).

## Format matrix (AC 2 routing) — 60 s fixture at 25 MB

| Input | Engine chosen | Output | Notes |
|---|---|---|---|
| H.264 MP4 | WebCodecs | 24.2 MB | |
| H.265 MP4 | WebCodecs | 24.2 MB | this Mac decodes HEVC in hardware |
| MOV | WebCodecs | 24.2 MB | |
| MKV | WebCodecs | 23.8 MB | |
| WebM (VP9+Opus) | WebCodecs | 24.5 MB | audio re-encoded Opus→AAC 128k |
| AVI (mpeg4+mp3, 104 MB) | **ffmpeg.wasm** | 23.8 MB | mediabunny can't parse AVI → ffmpeg probe + encode, 106 s |
| 900 s @ 16 MB | **ffmpeg.wasm** | routing verified | WebCodecs AAC floor (96 kbps) makes the budget infeasible; ffmpeg's 24 kbps floor fits |

## Large files (AC 4)

- **2.03 GB MP4 (1 h) @ 25 MB → completed**: 22.8 MB, 320x180@15, no tab
  crash. Input streamed via Blob-backed reads (never fully in memory);
  output assembled from 16 MiB chunks.
- **2.08 GB AVI → graceful refusal in ~1 s**: AVI requires the wasm engine,
  which pre-flight-rejects inputs over 1.5 GB with a clear message
  (wasm32 address-space limit). No load, no crash.

## Speed (AC 1)

305 MB / 300 s 1080p H.264 → 23.2 MB in 18.4 s ≈ **16× faster than
realtime** via WebCodecs on this machine. (Brief asks for a 200 MB file
faster than realtime; exceeded with margin.)

## Privacy / network audit (AC 5)

- Runtime: full compress flows captured via DevTools-equivalent network
  log — every request is same-origin (`localhost`) or `blob:`; zero
  third-party hosts, zero request bodies, zero uploads. The only fetches
  the product itself makes are the static assets and the self-hosted
  `/ffmpeg/*` core (lazy, same-origin, only on the fallback path).
- Code audit: `grep -rn "fetch(\|XMLHttpRequest\|sendBeacon\|WebSocket" src/`
  → single hit: `toBlobURL('/ffmpeg/...')` in `src/engines/ffmpeg.ts`.
- No unhandled promise rejections or window errors during a full run
  (listeners armed during the audit run: both arrays empty).

## Output validity

8 MB output re-parsed with mediabunny: proper MP4 container, `avc` video
+ `aac` audio, full 60.07 s duration, 864x486@30; plays and seeks in
Chrome `<video>`.

## Lighthouse (AC 6), mobile emulation, production build

| Page | Performance | Accessibility | SEO |
|---|---|---|---|
| / | 100 | 100 | 100 |
| /compress-video/ | 100 | 100 | 100 |
| /compress-video-to-25mb/ | 96 | 100 | 100 |
| /compress-video-to-10mb/ | 94 | 100 | 100 |
| /compress-video-for-whatsapp/ | 97 | 100 | 100 |

FAQPage JSON-LD generated at build time from the visible
`<details class="faq-item">` markup; question counts verified to match
on all four tool pages; homepage correctly has none.

## Keyboard / a11y (AC 7)

Structural: dropzone is a real `<button>` (Enter/Space open the picker),
controls are native radios in labeled fieldsets, custom target is a
labeled spinbutton, progress is `role="progressbar"` with polite
stage announcements (frame counts deliberately not live), compare slider
is a labeled `<input type=range>`, errors are `role="alert"`, focus moves
to the result heading on completion. Verified via accessibility-tree
snapshot; a human keyboard-and-VoiceOver pass is still recommended.

## Known-pending manual checks

These need a human or hardware this environment doesn't expose:

1. **Safari (real)** — full flow incl. AudioEncoder AAC behavior and
   @ffmpeg/ffmpeg's nested worker. Automation was blocked (Safari
   AppleScript permissions); needs a manual run.
2. **Firefox** — H.265 input should route to ffmpeg.wasm via
   `canDecodeVideo` returning false (capability check, not UA sniff);
   Firefox isn't installed on this machine.
3. **QuickTime / VLC playback** of an output file (Chrome playback and
   container re-parse both pass; QuickTime is the pickiest player).
4. **Real iPhone .mov (rotation metadata) and a VFR screen recording** —
   synthetic fixtures can't cover these. mediabunny handles rotation/VFR
   by design, but verify with a real clip.
5. Mobile Chrome (Android) / iOS Safari smoke test.
