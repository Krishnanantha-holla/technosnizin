# SONIQ — Build Plan

A full-screen immersive music visualizer. Upload a track or use mic input → the entire viewport becomes a reactive stage with per-instrument neon visual layers. Built on Lovable's Vite + React stack (Next.js mapped to React Router; NextAuth deferred with Spotify).

## Stack mapping (your spec → what ships)

| Spec | Implementation |
|---|---|
| Next.js 14 App Router | Vite + React + React Router |
| NextAuth Spotify | Skipped for v1 (route stub kept) |
| FastAPI + WebSocket backend | WebSocket client built to your exact contract; defaults to local FFT analysis when no backend URL is set |
| Three.js, Web Audio, Zustand, Tailwind, Lucide | Same |
| Fonts: Bebas Neue / Space Mono / Inter | Loaded from Google Fonts |

## Design system

Black (`#000`) background everywhere. Six instrument neon colors as CSS variables (`--bass`, `--drums`, `--guitar`, `--keys`, `--vocals`, `--other`) plus matching glow shadows. Bebas Neue display, Space Mono for UI/timestamps/BPM, Inter body. 44px min tap targets, neon focus rings, 200ms ease for chrome / physics-based for canvas. UI chrome auto-hides after 3s of mouse idle.

## Routes

- `/` — Landing. Logo top-left, big "FEEL EVERY INSTRUMENT" headline, subtitle, two CTAs (Connect Spotify [disabled, "soon"] + Upload a Track), idle ambient demo canvas at bottom.
- `/dashboard` — Main app. Idle state: drop zone + Live Input button. Active state: full-screen visualizer with floating chrome (track info, instrument legend, transport, genre badge).
- `/auth/spotify` — Stub page explaining Spotify is coming, link back.
- `/settings` — Account, Visualizer Defaults (preset, layers, quality), Audio (EQ, spatial), Privacy (history toggle, clear cache), About.
- `/history` — Last 10 analyzed tracks from localStorage.
- `*` — NotFound (existing).

## Visualizer engine

Full-viewport canvas behind all UI. Reads from `useVisualizerStore` exposing `InstrumentEnergy { bass, drums, guitar, keys, vocals, other }` updated 60fps from one of three sources:

1. **FFT mode (default)** — Web Audio `AnalyserNode` FFT, frequency-band mapping (sub-bass → bass, low-mid transients → drums, mid → guitar, high-mid → keys, 200–4kHz formant band → vocals).
2. **Backend mode** — WebSocket client matching your contract (`POST /api/analyze` → `WS /ws/{job_id}` → `{type:"progress"|"result"}`). Activates when `VITE_API_URL` + `VITE_WS_URL` are set.
3. **Live input** — `getUserMedia` (mic) or `getDisplayMedia` (system audio, Chrome only) → same FFT pipeline.

### Five presets (all built)

1. **STAGE** (default) — Layered: bass shockwave rings + floor glow + edge vignette; drums circular FFT ring + particle bursts + cyan kick flash; guitar Bezier arc tendrils via Perlin noise + corner glow; keys aurora curtains; vocals breathing central orb + spark trail.
2. **FLUID** — WebGL fragment-shader fluid sim (advection + dye injection per instrument at fixed positions). Viscosity / Diffusion / Color Blend controls.
3. **COSMOS** — Three.js, 3000 particles via `BufferGeometry` + `ShaderMaterial`. Bass = explosion+spring; drums = strobe; guitar = streaks; keys = aurora hue shift; vocals = galaxy rotation.
4. **PAINTING** — Persistent canvas (no clear), each instrument paints distinct strokes. Save-as-PNG button.
5. **PULSE** — Marching-squares metaball blob, single living organism reacting to all instruments.

Crossfade transitions between presets (0.5s). Switcher: bottom-right grid icon → horizontal preset cards with thumbnails.

## UI chrome (active state)

- **Top-left** — Track name + artist (Space Mono, dark scrim).
- **Top-right** — Instrument legend pill chips (pulsing dot when active, click to toggle layer) + settings gear.
- **Bottom-center** — Glass transport bar: restart, play/pause, time, gradient progress bar (live-blended from active instrument colors), draggable scrubber, duration, volume, FX button.
- **Bottom-left** — Genre badge (color-coded by genre, hover expands to BPM/key/energy).
- **Bottom-right** — Preset switcher.
- All fade out after 3s idle.

## FX Drawer

Slides up from bottom (320px). Sections:
- **Spatial** — Surround toggle (`StereoPannerNode` LFO), Atmos toggle (`ConvolverNode` reverb + bass `BiquadFilter`), Room Size slider.
- **EQ** — 5-band vertical sliders (Sub Bass / Bass / Mid / Presence / Air, ±12dB) via chained `BiquadFilterNode`s. Presets: Flat, Bass Boost, Vocal Clarity, Club, Acoustic.
- **Mixing** — Toggle Mix Mode → drop second file → A/B waveforms + crossfader + per-track gain.

All FX state persisted to `localStorage`.

## Live input

Mic / System Audio modal. Red blinking LIVE indicator replaces track name. Stop button in transport. Non-Chrome → friendly error toast for system audio.

## Extras (all included)

- Upload progress bar; analysis progress overlay over blurred canvas.
- Keyboard shortcuts: Space, ←/→, M, F, 1–5, L.
- Fullscreen mode.
- Toast system (bottom-right, color-coded left border, auto-dismiss 4s).
- BPM-synced global pulse (used by all presets when BPM is known).
- Analysis history (localStorage, last 10).
- Mobile: stacked transport on <400px, wrapped legend, touch scrubbing, `webkitAudioContext` fallback, safe-area padding, pinch-zoom disabled.

## File structure

Mirrors your spec under `src/` (Vite convention) instead of `app/`:

```text
src/
├── pages/         Index, Dashboard, AuthSpotify, Settings, History, NotFound
├── components/
│   ├── visualizer/ VisualizerCanvas, VisualizerSwitcher, presets/{Stage,Fluid,Cosmos,Painting,Pulse}
│   ├── dashboard/  DropZone, InstrumentLegend, TransportBar, GenreBadge, LiveInputButton, SpotifySearch (stub)
│   ├── audio/      AudioEngine, FXDrawer
│   ├── ui/         Toast, Modal, Button (extending shadcn)
│   └── layout/     Topbar
├── store/         usePlayerStore, useVisualizerStore, useAudioStore
├── hooks/         useWebSocket, useAudioEngine, useFFT, useKeyboardShortcuts
├── lib/           audioUtils, visualizerMath (Perlin, spring), fluidShaders
└── types/         index.ts
```

## Backend hook (ready, optional)

WebSocket client built exactly to your contract. Activated by setting `VITE_API_URL` and `VITE_WS_URL`. Until set, FFT mode runs and the upload flow simulates the progress overlay locally so the full UX is testable.

## Out of scope for v1

- Spotify OAuth (route + button stubbed; "Coming soon")
- Custom preset builder (waitlist input shown)
- Server-side share links (button hidden until backend present)

## Risks / honest notes

- This is a large build. Expect 1–2 follow-up rounds to polish edge cases (mobile FX drawer ergonomics, fluid shader perf on low-end GPUs, painting preset memory growth on long tracks).
- Fluid + Cosmos at full quality target 60fps on mid-range laptops; the Quality setting in Settings throttles particle count / shader iterations for weaker devices.
- FFT-derived "vocals" / "guitar" / "keys" energies are approximations — they look musical and reactive but aren't true source separation. Switching to your backend later is a one-env-var change.
