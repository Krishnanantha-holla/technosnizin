# SONIQ / `technosnizin` — Full Repository Audit & Master Fix-Prompt

> **Scope audited:** `soniq-backend` (FastAPI + Celery + Demucs/librosa ML), `soniq-frontend` (React + Vite), `soniq-svelte` (SvelteKit + WASM), root tooling, Docker, CI, env files, git history.
>
> **Purpose of this document:**
> 1. Inventory every anomaly / bug / security hole / design smell.
> 2. Rank them by blast radius (CRITICAL → HIGH → MEDIUM → LOW).
> 3. Pair each with a concrete solution.
> 4. End with a single **copy-paste prompt** you (or another AI) can feed to an agent to mechanically apply the fixes.

---

## 0. TL;DR — Executive Summary

| Area | Health | Headline issues |
|---|---|---|
| **Secrets / Git** | 🔴 Critical | Real Spotify **client secret** is committed in `soniq-backend/.env` (tracked!) and real **client ID** committed in both frontend `.env`/`.env.example`. `SECRET_KEY` is still the placeholder `"your-secret-key-min-32-chars"`. Must rotate credentials and purge history. |
| **Auth / API security** | 🔴 Critical | `/api/analyze` has **no auth** and **no rate limit** — anyone can upload files that trigger expensive Demucs runs. WebSocket `/ws/{job_id}` has **no authorization** — guessable job ids leak results. Spotify refresh tokens stored plaintext in DB and in `localStorage`. |
| **Backend correctness** | 🟠 High | Audio file loaded **twice** (wasteful), S3 validation **silently skipped**, MIME type trusted from client, `asyncio.run()` called inside sync Celery task ~3× per progress tick (dozens of event loops per job), `other` stem computed as synthetic `avg*0.1`, key detection **never returns minor keys**, dead `json.loads(...)` in `metadata.py`. |
| **Backend infra** | 🟠 High | Docker runs as **root**, no healthcheck, no multi-stage build (huge image), no `.dockerignore`. `docker-compose.yml` exposes Postgres/Redis on `0.0.0.0` with weak `soniq/soniq` credentials. Prod Nginx only listens on `:80`, no TLS. No logging/observability. |
| **React frontend** | 🟠 High | Uses Spotify `/audio-features` which was **deprecated Nov 27 2024** (new apps cannot access it). `AudioEngine` singleton subscribes to stores at module-load (HMR leak). `attachElement` silently leaves dangling `MediaElementSourceNode`. `URL.createObjectURL` never revoked. TypeScript `strict` is **off**. Default `vite_react_shadcn_ts` package name (Lovable scaffold not renamed). OG image + `.lovable/plan.md` leak Lovable branding. |
| **Svelte frontend** | 🟠 High | Entire `soniq-svelte/` **is not yet committed** (untracked). Uses **Svelte 4 syntax** (`<slot/>`, `on:click`, `svelte:component`) with `svelte ^5.28.0` declared — will break. `framer-motion` + `zustand` are **dead React-only deps** in a Svelte project. `wasm-engine/` has a nested `.git` inside your repo. Rust WASM uses `unsafe static mut` with fixed 1024 bins (panics on `fftSize=4096`). No tests. |
| **Monorepo / DX** | 🟡 Medium | Two entire frontends maintained in parallel with duplicated business logic. No monorepo tooling (pnpm workspaces / Turborepo). No root `Makefile`/`package.json`. No CI, no pre-commit, no ruff/mypy, no Prettier/ESLint config in svelte, no `.dockerignore`. Both `bun.lockb` **and** `package-lock.json` committed. `dist/` and `build/` folders on disk / committed. |
| **Testing** | 🟡 Medium | Backend: test-websocket uses `httpx.AsyncClient.websocket_connect` which **doesn't exist** — tests fail on run. Frontend: one trivial `expect(true).toBe(true)`. Svelte: none. |
| **Documentation** | 🟡 Medium | README does not mention the SvelteKit app or the WASM engine. `IMPROVEMENTS.md`'s "recommended next steps" are not implemented. |

**Bottom line:** the project has strong *vision* (immersive visualizer + real ML backend + dual frontends + Rust WASM DSP) and genuinely good visual/DSP work in the presets, but the **delivery layer** (secrets, auth, infra, tooling, monorepo hygiene) is not production-ready. This doc lays out everything needed to make it one.

---

## 1. Pros — what's genuinely good

Keep these. Do not regress them during the cleanup.

- **Clear architectural layering** in `soniq-backend/app/`: `api/`, `ml/`, `tasks/`, `services/`, `models/`, `schemas/`. Easy to navigate.
- **Async SQLAlchemy 2.0** with proper `AsyncSession` + `get_db()` dependency is done right.
- **Redis pub/sub + Celery + WebSocket progress** is the correct pattern for long-running ML jobs.
- **Alembic migrations** exist (not ad-hoc `create_all`).
- **PKCE OAuth flow** for Spotify on the frontend — correct modern pattern, no client secret in browser.
- **Per-instrument energy model** (`fftToEnergy`) with spectral flux for drums is a nice lightweight DSP approach.
- **Rust + WebAssembly engine** (`wasm-engine/`) with unit tests (`silent_frame_is_zero`, `full_blast_is_clamped`) — forward-thinking performance work.
- **Off-main-thread visualizer worker** (`visualizer.worker.ts`) with `OffscreenCanvas` — excellent for performance.
- **5 thoughtfully-designed visualizer presets** (Stage, Fluid, Cosmos 3D, Painting, Pulse) with reset hooks and crossfade transitions.
- **Quality-aware DPR scaling** in `VisualizerCanvas` — good UX for mixed hardware.
- **Equal-power crossfader** (`cos(x·π/2)/sin(x·π/2)`) in `AudioEngine` is mathematically correct.
- **Graceful fallback** from Spotify SDK (Premium) → preview_url (Free) → local FFT.
- **`IMPROVEMENTS.md`** shows prior engineering discipline — changelog-style per-fix documentation.

---

## 2. Cons — problems grouped by severity

Each finding is numbered `[C-##]` / `[H-##]` / `[M-##]` / `[L-##]` for cross-reference with the master prompt in §4.

### 🔴 CRITICAL — fix first, block a release until these are done

#### `[C-01]` Spotify client secret committed in git
- **Files:** `soniq-backend/.env` (**tracked**), `soniq-backend/.env.example`, `soniq-frontend/.env`, `soniq-frontend/.env.example`, `soniq-svelte/.env`.
- **Problem:** `SPOTIFY_CLIENT_SECRET=430737a7cfc34dffa80e4df239027648` and `SPOTIFY_CLIENT_ID=e7324553796a4525a9ba6305009438d3` are real credentials. The client secret gives full server-side Spotify API access. If the repo has ever been pushed to a public remote, consider these credentials **compromised**.
- **Solution:**
  1. **Rotate immediately** in the Spotify Developer Dashboard — regenerate the client secret and register a new one.
  2. `git rm --cached soniq-backend/.env` and add `soniq-backend/.env` to `soniq-backend/.gitignore` (currently only contains `.env`, should be explicit).
  3. Replace `.env.example` files with placeholder values only (`SPOTIFY_CLIENT_ID=your_client_id_here`).
  4. Purge history with `git filter-repo --invert-paths --path soniq-backend/.env` (destructive — needs user confirmation and coordinated push).
  5. Add a pre-commit hook with `gitleaks` / `detect-secrets` to prevent recurrence.

#### `[C-02]` Placeholder `SECRET_KEY` used for JWT signing
- **File:** `soniq-backend/.env` → `SECRET_KEY=your-secret-key-min-32-chars`.
- **Problem:** `auth.py` uses this key to sign JWTs with `HS256`. Anyone who reads the repo can forge a valid JWT for any user id.
- **Solution:**
  - In `.env.example`, document `SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(48))">`.
  - In `config.py`, add a startup assertion: if `APP_ENV != "development"` and `SECRET_KEY` contains the placeholder string, raise `RuntimeError` and exit.
  - Rotate the production key and invalidate all existing tokens.

#### `[C-03]` `/api/analyze` has no auth and no rate limiting
- **File:** `soniq-backend/app/api/analyze.py`.
- **Problem:** Uses `get_optional_user` — any anonymous client can POST a 50 MB file and trigger a Demucs job (minutes of GPU/CPU, ~2 GB RAM per run). This is a trivial DoS/cost-bomb.
- **Solution:**
  - Add `slowapi` (FastAPI rate limiter) with per-IP limits (e.g. 5 uploads / hour anonymous, 30 / hour authenticated).
  - Change signature to `current_user: User = Depends(get_current_user)` and provide a documented anonymous path only if explicitly desired (gated by a feature flag).
  - Enforce `Content-Length` max at the middleware level (`starlette.middleware.base`) so oversized bodies are rejected before being read.

#### `[C-04]` WebSocket `/ws/{job_id}` has no authorization
- **File:** `soniq-backend/app/api/websocket.py`.
- **Problem:** Anyone who knows or guesses a `job_id` (UUID4, but still discoverable via side channels) can stream the analysis result. Violates data privacy for authenticated uploads.
- **Solution:**
  - Require a JWT in the WebSocket subprotocol header or as a `?token=` query param; validate before `manager.connect()`.
  - On connect, load the `Job` row and assert `job.user_id == current_user.id` OR `job.user_id is None AND token_owner_is_uploader` (store a short-lived upload token).
  - Replace the 500 ms Redis polling loop with Redis pub/sub (`PUBSUB SUBSCRIBE job:{id}`) — eliminates polling overhead and latency.

#### `[C-05]` Spotify tokens stored plaintext in DB and in `localStorage`
- **Files:** `soniq-backend/app/models/user.py`, `soniq-backend/app/api/auth.py`, `soniq-frontend/src/lib/spotifyAuth.ts`, `soniq-svelte/src/lib/spotifyAuth.ts`.
- **Problem:** DB compromise leaks the raw refresh tokens of every user; XSS in the frontend leaks session tokens. For PKCE flows the access token lives in the browser anyway — but refresh tokens in `localStorage` are unnecessary since Spotify accepts PKCE-issued refresh tokens from the same origin.
- **Solution:**
  - Backend: encrypt `spotify_access_token` / `spotify_refresh_token` at rest using Fernet / libsodium with a key derived from `SECRET_KEY` (or a dedicated `TOKEN_ENCRYPTION_KEY`). Add a SQLAlchemy `TypeDecorator` or column-level encryption.
  - Frontend: move refresh tokens out of `localStorage` and into an `HttpOnly` cookie set by the backend callback handler (requires the backend to mediate token exchange — PKCE still works because the backend can be the confidential relay; or use BFF pattern).
  - Add a strict CSP (`default-src 'self'; connect-src 'self' https://api.spotify.com https://accounts.spotify.com; script-src 'self' https://sdk.scdn.co;`) to reduce XSS exfiltration risk.

#### `[C-06]` Spotify `/audio-features` endpoint is deprecated
- **Files:** `soniq-frontend/src/lib/spotifyMockEnergy.ts`, `soniq-svelte/src/lib/spotifyMockEnergy.ts`.
- **Problem:** Spotify announced on **Nov 27 2024** that `audio-features`, `audio-analysis`, `track recommendations`, `related-artists` etc. are unavailable to apps created after that date (and will be removed for existing apps). The entire "mock energy" pipeline for Premium SDK playback depends on it.
- **Solution (pick one, preferably the first):**
  1. **Use the backend** — when a Spotify URI is selected, POST the Spotify `track_id` to `/api/spotify/prefetch`; backend downloads the preview (30 s) or uses the embedded audio, runs librosa to extract tempo/energy/key, caches the result in Redis. Then drive the visualizer from cached features.
  2. Detect the deprecation at runtime — try `audio-features`, and on 403/404 fall back to a **real** analysis by piping the visualizer's own analyser node into a BPM detector (`onsets → tempo`).
  3. Use `Getsongbpm` or `MusicBrainz` + `AcousticBrainz` as a public metadata source.

#### `[C-07]` `soniq-svelte/` is not yet in git — entire project is a single uncommitted working copy
- **Evidence:** `git status -u soniq-svelte/` shows only `??` entries; `git ls-files soniq-svelte/` is empty.
- **Problem:** Any `git clean -fd` would obliterate the whole SvelteKit app (and the Rust WASM engine). No history, no review trail.
- **Solution:**
  1. Add a `soniq-svelte/.gitignore` that excludes `.svelte-kit/`, `build/`, `node_modules/`, `.env`, `src/lib/wasm-engine/target/`.
  2. Delete the nested `soniq-svelte/src/lib/wasm-engine/.git/` **or** convert it to a proper git submodule (`git submodule add …`).
  3. Stage and commit `soniq-svelte/` in reviewable chunks (config, stores, routes, lib, wasm, presets).

---

### 🟠 HIGH — substantial correctness / performance / DX issues

#### Backend

- **`[H-01]` Audio file loaded twice by librosa in `_validate_audio_file`**
  `analyze.py` calls `librosa.load(..., duration=5.0)` for a sanity check, then `librosa.load(..., )` again for full duration. For 50 MB files this is seconds of wasted CPU.
  **Fix:** Use `soundfile.info(path)` to get duration/sample rate without decoding, then decode once inside the pipeline.

- **`[H-02]` S3 validation silently skipped**
  `_validate_audio_file` has `if saved_path.startswith("s3://"): return` — files uploaded to S3 are never validated. A malicious client with `STORAGE_BACKEND=s3` can queue unbounded garbage.
  **Fix:** For S3, stream-download to a `tempfile.NamedTemporaryFile` and validate, or (better) validate **before** upload by reading the first chunk of the `UploadFile` for magic-byte detection.

- **`[H-03]` MIME type trusted from client; no magic-byte validation**
  `analyze.py` checks `file.content_type.startswith("audio/")` — this header is entirely client-controlled. An attacker can label `malicious.exe` as `audio/wav`.
  **Fix:** Use `python-magic` or inspect the first 12 bytes against known audio container signatures (`ID3`, `RIFF`/`WAVE`, `OggS`, `fLaC`, `ftypM4A`). Reject with 415 on mismatch.

- **`[H-04]` `asyncio.run()` called 3× per progress update inside sync Celery task**
  `analyze_task.py` has `update_progress` that calls `asyncio.run(_update_job(...))` — which creates and tears down a whole new event loop on every call (and `redis.hset` is sync on top of that). For a long job with ~10 stages this is ~30 event loops.
  **Fix:** Use a single `asyncio.new_event_loop()` held for the task's lifetime, or switch the whole task to `async def` via `celery[asyncio]` / `celery-redis-async`, or just use sync DB (`psycopg2`) for the task worker and skip the async hop entirely.

- **`[H-05]` Demucs invoked via `subprocess` → high startup cost**
  `separator.py` spawns `python -m demucs.separate` every job. Each invocation re-imports torch/librosa (~5 s) and re-loads model weights (~2 s) from disk.
  **Fix:** Import `demucs.api` (available since v4) and hold a single `demucs.api.Separator` instance at worker startup. Typical speedup: 7–10 s per job, plus it removes the dependency on a matching `python` binary in `$PATH`.

- **`[H-06]` `other` stem energy is synthetic garbage**
  `pipeline.py` computes `other = avg(bass+drums+vocals+guitar+keys)/5 * 0.1` — a constant fraction of everything else, not actually a residual.
  **Fix:** Drop `other` from the frontend schema entirely **or** make it a real residual: load the Demucs `other.wav` stem energy and subtract the ZCR-split `guitar`/`keys` portions.

- **`[H-07]` Guitar/keys split is naive ZCR**
  `classifier.classify_other_stem` uses `zero_crossing_rate` heuristics. ZCR separates noisy vs harmonic content, not guitar vs keys. Produces misleading per-instrument energy.
  **Fix:** Either drop the split and report a single `other` band, **or** train a small Yamnet/PANNs instrument tagger on the `other.wav` stem (they're already 10–30 MB models suitable for CPU).

- **`[H-08]` Key detection never returns minor keys**
  `genre.py` returns `f"{note_names[key_idx]} Major"` hardcoded.
  **Fix:** Use Krumhansl-Schmuckler profiles for both major and minor, correlate chroma against each, pick the max.

- **`[H-09]` `metadata.py` has dead code**
  `_ = json.loads(record.frames_json)` parses the frames then discards them, and `MetadataResponse` doesn't return frames anyway.
  **Fix:** Remove the dead parse; optionally add a separate `GET /api/frames/{job_id}` endpoint when frames are actually needed (keeps the metadata response small).

- **`[H-10]` WebSocket polls Redis every 500 ms**
  O(N_clients) polls even when no job is progressing. Wasteful at scale.
  **Fix:** Use `redis.asyncio.Redis.pubsub()` — subscribe to `job:{job_id}:progress` channel, `await pubsub.get_message(ignore_subscribe_messages=True, timeout=1)`. The Celery task `PUBLISH`es on each progress tick.

- **`[H-11]` Docker runs as root, single-stage, no healthcheck**
  `docker/Dockerfile.api` and `Dockerfile.worker` are identical and run everything as root. Image is enormous (~4 GB with torch + demucs).
  **Fix:**
  ```dockerfile
  FROM python:3.11-slim AS base
  RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
  RUN groupadd -r soniq && useradd -r -g soniq soniq
  WORKDIR /app
  COPY --chown=soniq:soniq requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY --chown=soniq:soniq . .
  USER soniq
  HEALTHCHECK --interval=30s --timeout=5s CMD curl -fsS http://localhost:8000/api/health || exit 1
  EXPOSE 8000
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```
  Add a `.dockerignore` that excludes `venv/`, `.git/`, `__pycache__/`, `tests/`, `uploads/`, `.env*`.

- **`[H-12]` Postgres/Redis exposed on 0.0.0.0 with weak creds**
  `docker-compose.yml` maps `5432:5432` and `6379:6379` on the host with `soniq/soniq`. Fine on a laptop, disastrous on a shared dev box or cloud VM.
  **Fix:** Bind to `127.0.0.1` by default (`"127.0.0.1:5432:5432"`). For prod compose, don't publish these ports at all — internal network only. Generate strong default passwords via `.env`.

- **`[H-13]` Tests broken on run**
  `tests/test_websocket.py` uses `async_client.websocket_connect(...)` — this method doesn't exist on `httpx.AsyncClient`. You need `starlette.testclient.TestClient` (sync) or `ASGI-lifespan` + `websockets` client.
  **Fix:** Convert WebSocket tests to sync `TestClient`:
  ```python
  from starlette.testclient import TestClient
  def test_ws(): 
      with TestClient(app).websocket_connect("/ws/abc") as ws: ...
  ```

- **`[H-14]` `event_loop` fixture deprecated in pytest-asyncio**
  `tests/conftest.py` manually overrides `event_loop` — deprecated since pytest-asyncio 0.23.
  **Fix:** Add `asyncio_mode = "auto"` in `pytest.ini` / `pyproject.toml`; remove the custom fixture.

- **`[H-15]` SQLAlchemy String PKs storing UUIDs**
  Causes full-string index scans; slower than a proper UUID column.
  **Fix:** Switch to `sqlalchemy.dialects.postgresql.UUID(as_uuid=True)` for `id`, `job_id`, `user_id`, `result_id`. Write an Alembic migration that `ALTER COLUMN … TYPE uuid USING id::uuid`.

- **`[H-16]` No indexes and no `ON DELETE CASCADE`**
  `Job.user_id`, `Job.result_id`, `AnalysisResult.job_id` FKs have no index; deleting a user orphans jobs.
  **Fix:** Add `index=True` on all FK columns; add `ondelete="CASCADE"` on `ForeignKeyConstraint`.

#### React frontend

- **`[H-17]` `AudioEngine.attachElement` silently leaks on every file load**
  ```ts
  try {
    const node = this.ctx.createMediaElementSource(el);
    node.connect(this.gainA);
    this.srcNode = node;
  } catch { /* Element already connected */ }
  ```
  If the audio element is already connected, the `catch` keeps the **old** `srcNode` — but `detachSource()` only disconnects `this.srcNode`, not the original one. Worse, after `attachElement` succeeds once, subsequent calls with the same `<audio>` always go through the `catch`, so the new `gainA` routing silently never happens.
  **Fix:** Never re-use an `HTMLAudioElement` across sources. Either (a) hold a single element forever and only swap `.src`, or (b) create a new `<audio>` on each file and attach it. Also remember the node keyed by the element:
  ```ts
  const existing = this.elementNodes.get(el);
  if (existing) this.srcNode = existing;
  else {
    const node = this.ctx.createMediaElementSource(el);
    this.elementNodes.set(el, node);
    node.connect(this.gainA);
    this.srcNode = node;
  }
  ```

- **`[H-18]` `URL.createObjectURL` never revoked**
  `Dashboard.loadFile` creates an object URL but never calls `URL.revokeObjectURL`. Every uploaded file is held in memory forever.
  **Fix:** Save the URL on `trackInfo`, revoke in `stopLive` / `reset` / next `loadFile`, and on `beforeunload`.

- **`[H-19]` `await a.onloadedmetadata` can hang forever**
  No timeout and no error handler — a corrupt file never resolves the promise and the UI stays stuck on the analysis overlay.
  **Fix:**
  ```ts
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('metadata timeout')), 10_000);
    a.onloadedmetadata = () => { clearTimeout(t); resolve(); };
    a.onerror = () => { clearTimeout(t); reject(new Error('audio load error')); };
  });
  ```

- **`[H-20]` `AudioEngine` subscribes to Zustand at module-load, never unsubscribes**
  The file-scoped `useAudioStore.subscribe(() => audioEngine.applyAudioState())` creates a subscription that survives HMR and multiple mounts. Over time (especially during dev) this stacks up callbacks.
  **Fix:** Wire subscriptions inside a React `useEffect` in a root-level `AudioEngineProvider` component, returning the unsub on cleanup.

- **`[H-21]` `window.__soniqAlbumArt` global hack**
  Global state passed through the `window` object between `Dashboard` and album-art renderers.
  **Fix:** Put `albumArt` in `usePlayerStore` or pass via props. Kill the global.

- **`[H-22]` TypeScript `strict` disabled**
  `tsconfig.json` overrides `app.json` with `strict: false`, `strictNullChecks: false`, `noImplicitAny: false`. All of TS's safety is off.
  **Fix:** Remove these overrides; fix the fallout (`any` + `| null` handling). Enabling strict will likely surface several latent bugs in `spotifyPlayer`, `VisualizerCanvas`, and the presets.

- **`[H-23]` Package name is Lovable scaffold default**
  `package.json` → `"name": "vite_react_shadcn_ts"`.
  **Fix:** Rename to `"soniq-frontend"` and bump version to `1.0.0`.

- **`[H-24]` Lovable branding leak**
  `index.html` og:image points to `pub-bb2e103…r2.dev/…/lovable.app…png`; `.lovable/plan.md` tracked; `lovable-tagger` plugin in dev deps.
  **Fix:** Replace OG image with your own SONIQ asset hosted on your infra; remove `.lovable/` directory from git; optional: keep `lovable-tagger` but document why.

- **`[H-25]` Duplicate lockfiles**
  `bun.lockb` + `package-lock.json` both tracked. Different package managers will produce divergent dependency graphs.
  **Fix:** Pick one (npm or bun). Delete the other from git and `.gitignore` it.

- **`[H-26]` `dist/` folder committed**
  Build output shouldn't be in source control.
  **Fix:** Add `dist/` to `soniq-frontend/.gitignore` and `git rm -r --cached soniq-frontend/dist`.

#### Svelte frontend

- **`[H-27]` Svelte 5 declared but Svelte 4 syntax used**
  `package.json` has `"svelte": "^5.28.0"`. `+layout.svelte` uses `<slot />` (Svelte 4) and `<svelte:component this={Toaster} …>` which is deprecated in Svelte 5; all components use `on:click`, `on:change`, `on:dragover` (Svelte 4 event syntax).
  **Fix:** Either downgrade to Svelte 4 **or** migrate:
  - `<slot />` → `{@render children()}` with `let { children } = $props()`.
  - `on:click={…}` → `onclick={…}`.
  - `<svelte:component this={Toaster} />` → just `<Toaster />` (dynamic components in Svelte 5 are done with the component type directly).
  - Replace `export let onFile` in child components with `let { onFile } = $props()`.
  - Run `npx sv migrate svelte-5` for a mechanical first pass, then fix residuals.

- **`[H-28]` Dead React-only dependencies in Svelte `package.json`**
  `framer-motion` and `zustand` are React libraries. They bloat `node_modules` by ~6 MB and do nothing.
  **Fix:** `npm rm framer-motion zustand`. Use CSS transitions or `svelte/motion` and `svelte/store` instead.

- **`[H-29]` Nested `.git` inside `wasm-engine`**
  `soniq-svelte/src/lib/wasm-engine/.git/` — git treats it as an embedded repo; commit produces a warning and the inner history is lost.
  **Fix:** Either `rm -rf soniq-svelte/src/lib/wasm-engine/.git` and commit the Rust source as part of this repo, or `git submodule add <url> soniq-svelte/src/lib/wasm-engine`.

- **`[H-30]` Rust `unsafe { static mut PREV_FREQ: [f32; 1024] }` is fragile**
  `wasm-engine/src/lib.rs` uses a fixed-size static buffer with `unsafe` access. Any caller passing more than 1024 bins (e.g. `fftSize = 4096`) would index past the array — protected only by `i.min(1023)` at the call site. Also not thread-safe (fine in single-threaded WASM today, but the moment wasm-threads / SharedArrayBuffer is used, UB).
  **Fix:** Wrap state in a `thread_local!` `RefCell<Vec<f32>>` that auto-grows, or pass `prev: &mut [f32]` from JS as a parameter (like `smooth_energy` already does).

- **`[H-31]` No `.gitignore` for `soniq-svelte/` will commit `build/`, `.svelte-kit/`, `wasm-engine/target/`**
  `.svelte-kit/` regenerates on every `dev`, `target/` is hundreds of MB of Rust artifacts.
  **Fix:** Create `soniq-svelte/.gitignore`:
  ```
  node_modules/
  .svelte-kit/
  build/
  .env
  .env.*
  !.env.example
  src/lib/wasm-engine/target/
  src/lib/wasm-engine-pkg/*.wasm
  src/lib/wasm-engine-pkg/*.js
  src/lib/wasm-engine-pkg/*.d.ts
  ```
  (Commit the `wasm-engine-pkg` package.json and build the wasm in CI — or commit the built artifacts and document the rebuild command.)

- **`[H-32]` `+layout.svelte` dynamic Toaster import every page**
  `await import('sonner')` on every `onMount`. SvelteKit already supports dynamic imports at the route level, but `onMount` is client-only so a static import would have been fine with adapter-static.
  **Fix:** Move `import { Toaster } from 'sonner'` to the top; mark the layout as client-only with a check for `browser` if needed. SvelteKit's SSR is off (adapter-static + fallback) so there's no SSR concern.

- **`[H-33]` `adapter-static` needs prerender configuration**
  With `fallback: 'index.html'`, SvelteKit still tries to prerender pages without `export const prerender = false`. Pages that use client-only APIs (localStorage) will error.
  **Fix:** Add `src/routes/+layout.ts`:
  ```ts
  export const prerender = false;  // SPA mode
  export const ssr = false;
  ```

#### Cross-cutting high-severity

- **`[H-34]` Two frontends duplicating all business logic**
  `AudioEngine.ts`, `spotifyAuth.ts`, `spotifyApi.ts`, `spotifyPlayer.ts`, `spotifyMockEnergy.ts`, `analysisClient.ts`, `audioUtils.ts`, `visualizerMath.ts`, types, and all five presets exist twice. They *already* diverge (e.g. the Svelte `spotifyAuth` has extra scopes `user-top-read`, `user-read-recently-played`).
  **Fix (pick one):**
  - **A (recommended if Svelte is the future):** delete `soniq-frontend/`, keep SvelteKit.
  - **B (recommended if React is the future):** delete `soniq-svelte/`, keep React.
  - **C (if both must stay):** extract `@soniq/core` (framework-agnostic TS package) with DSP, Spotify auth/api, analysis client, audio engine primitives. Each frontend imports it via a pnpm workspace / Turborepo.
  - **D (monorepo bare minimum):** keep the duplication but add a pnpm workspace and a CI job that diffs the two copies to force them to stay in sync.

- **`[H-35]` No CI, no pre-commit, no linting across the board**
  **Fix:** Add `.github/workflows/ci.yml`:
  - `backend`: `pip install -r requirements-dev.txt && ruff check . && mypy app && pytest --cov`.
  - `frontend`: `npm ci && npm run lint && npm run test && npm run build`.
  - `svelte`: `npm ci && npm run check && npm run build`.
  - `wasm`: `cargo fmt --check && cargo clippy -- -D warnings && cargo test && wasm-pack build --target web`.
  Add `.pre-commit-config.yaml` with `ruff`, `black`, `mypy`, `eslint`, `prettier`, `gitleaks`.

---

### 🟡 MEDIUM — worth addressing for quality & maintainability

- **`[M-01]` `config.py` uses Pydantic `BaseSettings` but doesn't reject unknown env vars in production.** Consider `extra="forbid"` under prod so typos in `.env` fail fast.
- **`[M-02]` `CORS_ORIGINS` not validated to reject `*` when `allow_credentials=True`.** Browsers will silently ignore wildcard + credentials, hiding the misconfiguration.
- **`[M-03]` `boto3` client initialized without retry/timeout config.** Add `Config(retries={'max_attempts': 5, 'mode': 'adaptive'}, connect_timeout=5, read_timeout=30)`.
- **`[M-04]` No structured logging.** Add `structlog` or `loguru`, emit JSON in prod, pipe to stdout. Celery tasks print exceptions to stderr but nothing is captured.
- **`[M-05]` `scripts/seed_db.py` creates a user without `spotify_id`** and uses `print()`. Convert to a proper CLI with `typer` and make seed data explicit.
- **`[M-06]` `alembic.ini` has `sqlalchemy.url = postgresql+asyncpg://…`** hardcoded even though `env.py` overrides it. Remove from `ini` to avoid confusion; leave the override.
- **`[M-07]` No request ID / correlation ID.** Add a middleware that attaches `X-Request-ID`; propagate into Celery task headers so logs for a single upload chain together.
- **`[M-08]` No OpenAPI tags/examples on request bodies.** Add `Field(..., example=...)` to Pydantic schemas for better `/docs`.
- **`[M-09]` `analyze.py` hardcodes the list of allowed extensions.** Move to `settings.ALLOWED_AUDIO_EXTENSIONS` so ops can tune without a code change.
- **`[M-10]` React `VisualizerCanvas` `QUALITY_DPR` is module-scope.** `window.devicePixelRatio` changes when the user drags the window between displays. Recompute on `matchMedia('(resolution: …)').change`.
- **`[M-11]` `useChromeAutoHide` + `useKeyboardShortcuts` both bind `keydown`.** Shortcut presses also reset the chrome-hide timer — correct behaviour, but the double listener is wasteful. Consolidate into one listener.
- **`[M-12]` `spotifyPlayer.ts` fires synthetic state events every 500 ms** for position interpolation, invoking every listener with a full object copy. Use a dedicated `onPosition` channel that only emits `{position}` and debounce at 100 ms with `requestAnimationFrame`-aligned ticks.
- **`[M-13]` `SpotifySearch.tsx/.svelte` debounces at 350 ms** — fine, but missing an `AbortController` so stale responses can overwrite newer ones. Add `signal: abortController.signal` to `fetch`.
- **`[M-14]` `DropZone` trusts `accept="audio/*"`** — spoofable in the browser. The backend validation fix (`[H-03]`) covers this, but add client-side magic-byte check too for instant UX feedback.
- **`[M-15]` `useAudioStore` reads `localStorage` at module-load.** Fine for an SPA, but if you ever ship SSR, wrap in `typeof window !== 'undefined'`. Apply same to Svelte `visualizer.ts` / `audio.ts` stores.
- **`[M-16]` `vite.config.ts` has `server.hmr.overlay: false`** (both frontends) — hides errors. Turn it on in dev; you want to see what breaks.
- **`[M-17]` Missing `eslint` + `prettier` in `soniq-svelte/`.** Add `eslint-plugin-svelte`, `prettier-plugin-svelte`.
- **`[M-18]` `analysisClient.ts` JSON parse errors silently swallowed.** Log + reject the promise.
- **`[M-19]` `analysisClient.ts` WebSocket has no reconnect/backoff.** Wrap in a `ReconnectingWebSocket` (1 s → 2 s → 4 s up to 30 s cap, reset on successful message).
- **`[M-20]` No error boundary / global error handler** in either frontend. React: add `react-error-boundary` around routes. Svelte: `+error.svelte` exists but is minimal — add logging.
- **`[M-21]` React `eslint.config.js` disables `@typescript-eslint/no-unused-vars`.** Turn it back on; dead imports are hiding.
- **`[M-22]` `tailwind.config.ts` scans `./pages/**`, `./components/**`, `./app/**`** — legacy Next.js paths that don't exist here. Clean up content globs.
- **`[M-23]` `components.json`** (shadcn/ui) is tracked but many referenced primitives (accordion, alert, avatar…) were deleted per git status. Either reinstall the shadcn primitives or prune the config.
- **`[M-24]` Rust `Cargo.lock` tracked for a `cdylib` crate** — normally you'd gitignore `Cargo.lock` for libraries; for a wasm app it's fine to keep, but pick a policy and document it.
- **`[M-25]` `soniq-svelte/src/routes/spotify/+page.svelte` is 61 KB.** That's a monolith — a full player UI + playlist + queue + lyrics all in one file. Split into components under `src/lib/components/spotify/`.
- **`[M-26]` `IMPROVEMENTS.md`'s "What's Next" list** (BPM-sync presets, custom preset builder, preset thumbnails, share links) — convert into GitHub issues with priorities so they don't rot in a doc.
- **`[M-27]` No observability.** Add Sentry (frontend + backend), Prometheus `/metrics` endpoint (`prometheus-fastapi-instrumentator`), and OpenTelemetry traces for the `analyze → celery → ws` pipeline.
- **`[M-28]` `scripts/download_models.py` uses `print()` and bare `subprocess.run`** with no retry. Users behind spotty networks will fail mid-download. Use `huggingface_hub.snapshot_download` with `local_dir_use_symlinks=False`.

---

### 🟢 LOW — polish / nice-to-have

- **`[L-01]`** Replace `React.FC` if any / use plain function components (project is already inconsistent).
- **`[L-02]`** `vite-env.d.ts` could declare `import.meta.env` typed vars for `VITE_API_URL` etc. so TS catches typos.
- **`[L-03]`** `useKeyboardShortcuts` could ignore events when `document.activeElement` is `contentEditable`.
- **`[L-04]`** `AudioEngine.startLoop` calls `requestAnimationFrame` even when the context is suspended — negligible but avoidable; pause the RAF when `ctx.state === 'suspended'`.
- **`[L-05]`** `pipeline.py` uses `max_len = max((len(lst) for lst in all_lists), default=0)` — slightly inefficient since all stems have the same length once padded. Compute from a single stem's duration.
- **`[L-06]`** `spotifyMockEnergy` imports `useVisualizerStore` directly — couples a utility to a framework-specific store.
- **`[L-07]`** Log Spotify API errors with body text at debug level, not error (reduces noise on transient 429s).
- **`[L-08]`** `README.md` says "Proprietary — SONIQ Project" but there's no `LICENSE` file. Add one or change the claim.
- **`[L-09]`** `AudioEngine.applyAudioState` re-reads the entire audio store every time — could cache the last-applied values and only update changed params.
- **`[L-10]`** `TransportBar.WaveformBars` uses `framer-motion` spring animation per frame — `animate={{ height: h }}` is fine but each bar triggers its own spring. Use `motion.div style={{ height }}` for cheaper updates.
- **`[L-11]`** All visualizer presets are ~200-400 LoC; add JSDoc for `render*` signatures so IDE tooltips help contributors.
- **`[L-12]`** `reset()` on `AudioEngine` only resets the visualizer; also cancel the RAF on `detachSource` when nothing is playing.
- **`[L-13]`** Backend's `Job` model has no `updated_at` trigger assertion in Alembic — rely on `onupdate=func.now()`.
- **`[L-14]`** Add `robots.txt` with `Disallow: /api/` and a proper `sitemap.xml`.
- **`[L-15]`** Remove the `placeholder.svg` 28 KB file if unused.
- **`[L-16]`** Remove commented-out OG twitter meta in `index.html`.
- **`[L-17]`** `soniq-frontend/src/App.css` is empty — delete it.
- **`[L-18]`** `scripts/seed_db.py` should use `logging.getLogger(__name__)`, not `print`.
- **`[L-19]`** Consider `pyproject.toml` + `pip-tools` / `uv` instead of raw `requirements.txt` for reproducible pins.
- **`[L-20]`** Add `Makefile` at repo root: `make up`, `make test`, `make fmt`, `make db-migrate` for one-command workflows.

---

## 3. Cross-cutting architectural recommendations

1. **Pick one frontend.** Running two full frontends doubles every maintenance action. My recommendation: keep SvelteKit (smaller runtime, Rust/WASM integration, shows more modern skill) *or* keep React (larger ecosystem, more hireable). If you genuinely need both for demo/portfolio reasons, extract a shared `@soniq/core` npm package.
2. **Make the backend optional-but-seamless.** Today `backendEnabled()` gates analysis, but the live-FFT path overlaps awkwardly with the SDK-mock path. Unify: one `EnergyProvider` interface with three impls (`LiveFFTProvider`, `BackendAnalysisProvider`, `SpotifyMockProvider`), register at boot.
3. **Move Spotify token exchange behind the backend (BFF).** Replaces plaintext-in-localStorage tokens with HttpOnly cookies, enables server-side audio-features replacement, and lets you add a centralized rate-limit.
4. **Make the WASM engine the default DSP path.** The worker already loads it; wire `AudioEngine.startLoop` to post FFT frames to the worker, and have the worker return energy. Retire `audioUtils.fftToEnergy` on the main thread.
5. **Publish a versioned contract** between backend and frontend. Generate TypeScript types from FastAPI's OpenAPI schema (`openapi-typescript`). Breaks = caught at compile time.
6. **Add a monorepo layer.** pnpm workspaces + Turborepo give you one-command install, build cache, and a place for `@soniq/core`.
7. **Add observability before you ship.** Sentry is 10 minutes of work for each client; `prometheus-fastapi-instrumentator` is 4 lines. Without these you're flying blind.
8. **Document the WASM build.** `wasm-pack build --target web --release` with a note about `-C target-feature=+simd128` needs to be in the README and in CI.

---

## 4. Master Fix-Prompt (copy-paste this into your AI agent)

> Paste everything between the `<<<` and `>>>` markers as a single prompt. Run it against the repo at `/home/krishnanantha/crazyshiz/technosnizin`. The agent should perform fixes in the order given (Phase 0 first, then Phase 1, etc.) and commit after each phase with a conventional-commit message.

<<<
You are a senior full-stack + DevOps engineer tasked with elevating the SONIQ monorepo (`technosnizin`) to production quality. The repo contains:

- `soniq-backend/` — FastAPI + Celery + PostgreSQL + Redis + Demucs/librosa ML.
- `soniq-frontend/` — React + Vite + TypeScript.
- `soniq-svelte/` — SvelteKit (Svelte 5) + WebAssembly (Rust).

All findings, IDs, and rationale are in `FIX_PROMPT.md` at the repo root. Implement the fixes in the phases below. After each phase: run the full test suite, run the builds, and commit with `feat|fix|chore|refactor(scope): <summary>`. Never commit secrets. Ask the user before any destructive git operation (filter-repo, force-push, branch delete).

### Phase 0 — Secrets & git hygiene (BLOCKING)
1. `[C-01] [C-02]` Rotate the Spotify client secret in the Spotify Dashboard (instruct the user; don't do it yourself). Generate a new `SECRET_KEY` via `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Replace `.env` values; scrub `.env.example` to contain placeholders only (`your_client_id_here`, `change-me-<random 48 chars>`).
2. Ensure `.env` is gitignored at the root AND at each sub-project; `git rm --cached soniq-backend/.env`.
3. Add `.dockerignore` at `soniq-backend/` (exclude `.git`, `.env*`, `__pycache__`, `venv`, `tests`, `uploads`, `.pytest_cache`, `htmlcov`).
4. `[C-07]` Create `soniq-svelte/.gitignore` (exclude `node_modules`, `.svelte-kit`, `build`, `.env*` except `.env.example`, `src/lib/wasm-engine/target`).
5. `[H-29]` Decide on submodule vs inline for `soniq-svelte/src/lib/wasm-engine/` — default: remove the nested `.git`, commit sources inline. Ask user if they want a submodule.
6. `[H-25]` Remove `soniq-frontend/bun.lockb` from git; keep `package-lock.json`. Add `bun.lockb` to `.gitignore`.
7. `[H-26]` `git rm -r --cached soniq-frontend/dist`; add `dist/` to `.gitignore`.
8. Add `.pre-commit-config.yaml` with `ruff`, `ruff-format`, `mypy`, `eslint`, `prettier`, `gitleaks`, `detect-secrets`. Install with `pre-commit install`.
9. Add `FIX_PROMPT.md` to `.gitignore`? NO — keep it tracked as living docs.
10. Commit: `chore(secrets): remove committed .env, rotate keys, add pre-commit`.

### Phase 1 — Backend security & correctness (CRITICAL + HIGH)
1. `[C-03]` Add `slowapi` rate limiting; require JWT on `/api/analyze` via `Depends(get_current_user)`; add `Content-Length` middleware enforcing `MAX_FILE_SIZE_MB`.
2. `[C-04]` Require JWT on WebSocket; switch from 500 ms Redis poll to `redis.asyncio.Redis.pubsub()` on `job:{id}:progress`; publish from Celery task.
3. `[C-05]` Encrypt `spotify_access_token` / `spotify_refresh_token` columns with Fernet (key from `TOKEN_ENCRYPTION_KEY` env); write `alembic` migration.
4. `[H-01][H-02][H-03]` Replace double `librosa.load` with `soundfile.info` + single load; validate S3 uploads by downloading header; add `python-magic` magic-byte check.
5. `[H-04]` Rework `analyze_task` to run the pipeline synchronously with sync DB (swap `asyncpg` for `psycopg2` in the worker session) OR hold a single event loop for the task.
6. `[H-05]` Replace `subprocess` Demucs with `demucs.api.Separator` held at worker boot.
7. `[H-06][H-07]` Drop synthetic `other`; implement real Krumhansl-Schmuckler key detection (major+minor) in `genre.py`; replace ZCR guitar/keys split with a Yamnet tagger OR consolidate into a single `other` band.
8. `[H-08][H-09]` Add both major and minor keys; remove the dead `json.loads(record.frames_json)` in `metadata.py`; add `GET /api/frames/{job_id}` if needed.
9. `[H-11]` Rewrite Dockerfiles as multi-stage, non-root, with `HEALTHCHECK`. Add `.dockerignore`.
10. `[H-12]` Bind Postgres/Redis to `127.0.0.1` in dev compose; remove ports in prod compose (internal network only); generate strong default passwords in `.env.example`.
11. `[H-13][H-14]` Fix `tests/test_websocket.py` using `starlette.testclient.TestClient`; set `asyncio_mode="auto"` in `pyproject.toml`; remove deprecated `event_loop` fixture; add `tests/__init__.py`.
12. `[H-15][H-16]` Migrate String PKs to `UUID`; add indexes on all FKs; add `ondelete="CASCADE"`.
13. Add `ruff`, `mypy`, `pyproject.toml`, `pre-commit`, structured logging with `structlog`.
14. Commit: `feat(backend): auth, rate limiting, token encryption, secure docker, ML fixes`.

### Phase 2 — Frontend (React) hardening (HIGH)
1. `[H-17]` Rewrite `AudioEngine.attachElement` with a `WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>` cache.
2. `[H-18]` Revoke `URL.createObjectURL` on track change, reset, and `beforeunload`.
3. `[H-19]` Add timeout + error handler to `loadedmetadata` wait.
4. `[H-20]` Move Zustand subscriptions inside a React `AudioEngineProvider` effect with cleanup.
5. `[H-21]` Move `albumArt` into `usePlayerStore`; remove `window.__soniqAlbumArt`.
6. `[H-22]` Remove the `strict:false / strictNullChecks:false / noImplicitAny:false` overrides from `tsconfig.json`; fix resulting errors.
7. `[H-23]` Rename `package.json` to `"soniq-frontend"`.
8. `[H-24]` Replace OG image URL; remove `.lovable/` from git.
9. `[C-06]` Replace `spotifyMockEnergy` audio-features call with a backend-proxied endpoint `POST /api/spotify/track/:id/features` that calls librosa on the preview_url. Cache in Redis.
10. `[M-10][M-11][M-12][M-13][M-19][M-20]` Apply the medium fixes (DPR listener, consolidate keydown, interpolation throttle, AbortController, WS reconnect, error boundary).
11. Remove `axios` from `dependencies` (unused).
12. Commit: `fix(frontend): audio engine leaks, strict TS, spotify features proxy`.

### Phase 3 — Svelte app stabilization (HIGH)
1. `[H-27]` Migrate to Svelte 5 idioms: `{@render children()}`, `$props()`, `onclick` event syntax. Run `npx sv migrate svelte-5`.
2. `[H-28]` Remove `framer-motion` and `zustand` from `package.json` and all imports; use `svelte/motion` / `svelte/store` / CSS transitions.
3. `[H-31][H-33]` Add `.gitignore` (see Phase 0); add `+layout.ts` with `prerender = false; ssr = false;`.
4. `[H-30]` Refactor Rust `PREV_FREQ` to `thread_local!` or pass buffer from JS.
5. `[M-25]` Split `routes/spotify/+page.svelte` into `lib/components/spotify/*.svelte`.
6. `[M-17]` Add `eslint-plugin-svelte`, `prettier-plugin-svelte`.
7. Mirror the React fixes for `AudioEngine` attach bug, URL revoke, metadata timeout, WS reconnect.
8. Commit: `refactor(svelte): svelte 5 migration, remove dead deps, fix audio engine`.

### Phase 4 — Monorepo / DX / CI (MEDIUM)
1. `[H-34]` Decide on single-frontend OR extract `@soniq/core`. If unsure, open a PR with the `@soniq/core` skeleton and let the user review.
2. Add root `package.json` with pnpm workspaces + Turborepo (or Nx). `make up`, `make test`, `make lint`, `make build` via a top-level `Makefile`.
3. `[H-35]` Add `.github/workflows/ci.yml` running backend tests, frontend build+test+lint, svelte build+check, wasm `cargo test` + `wasm-pack build`.
4. Add `.github/workflows/docker.yml` that builds + scans (`trivy`) images on tag.
5. `[M-27]` Integrate Sentry on both frontends and backend; add `prometheus-fastapi-instrumentator` and expose `/metrics`; add request-id middleware.
6. Generate OpenAPI TypeScript types from the backend; make both frontends consume them.
7. Commit per feature: `chore(monorepo): workspace + turborepo`, `ci: github actions`, `feat(observability): sentry + prometheus`.

### Phase 5 — Documentation & release prep (LOW/MEDIUM)
1. Update root `README.md`: add SvelteKit section, WASM build instructions, env var matrix, deployment runbook (TLS, secrets management, Sentry DSN).
2. Add `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` (match README's "proprietary" claim or replace with MIT/Apache-2.0).
3. Turn `IMPROVEMENTS.md`'s "What's Next" into GitHub issues.
4. Write a postmortem in `docs/secret-leak-response.md` documenting `[C-01]` rotation steps.
5. Tag `v1.0.0-rc1` once all CI green.

### Constraints
- Do **not** rewrite the visualizer presets; they are the most creative part and shouldn't be touched unless broken.
- Preserve the equal-power crossfade math in `AudioEngine`.
- Preserve Alembic migration history — always add new migrations, never edit old ones.
- Do **not** remove the Rust WASM engine; it's an asset.
- Prefer additive changes; when deletion is needed, note the removed file in the commit message.
- Whenever ambiguous, ask the user rather than guess (especially: single-frontend choice, license choice, whether to keep the Lovable Vite plugin).

### Deliverables (check each off in the final PR description)
- [ ] Secrets rotated, `.env` removed from history.
- [ ] `/api/analyze` + `/ws/{job_id}` auth + rate limit.
- [ ] Spotify token encryption.
- [ ] Backend ML fixes (single-load, demucs.api, real key detection).
- [ ] Secure Dockerfiles (non-root, healthcheck, multi-stage).
- [ ] Frontend memory leak + strict-TS + package rename fixes.
- [ ] Svelte 5 migration complete, dead deps removed.
- [ ] Workspace + Turborepo + CI green.
- [ ] Sentry + Prometheus wired.
- [ ] README + CONTRIBUTING + SECURITY + LICENSE.
- [ ] `pytest` + `vitest` + `svelte-check` + `cargo test` all pass in CI.

When you finish, write a `POST_FIX_REPORT.md` summarising what changed, what's still open, and what a reviewer should check.
>>>

---

## 5. Appendix — quick reference map

| Finding | File(s) | Phase |
|---|---|---|
| C-01 | `soniq-backend/.env`, all `.env.example` | 0 |
| C-02 | `soniq-backend/.env`, `app/config.py` | 0 / 1 |
| C-03 | `app/api/analyze.py` | 1 |
| C-04 | `app/api/websocket.py` | 1 |
| C-05 | `app/models/user.py`, `app/api/auth.py`, both `spotifyAuth.ts` | 1 / 2 |
| C-06 | both `spotifyMockEnergy.ts` | 2 |
| C-07 | `soniq-svelte/**` | 0 |
| H-01…H-10 | `soniq-backend/app/**` | 1 |
| H-11…H-16 | `soniq-backend/docker/**`, `docker-compose*.yml`, `tests/**`, `models/**` | 1 |
| H-17…H-26 | `soniq-frontend/src/**`, `package.json`, `index.html`, `tsconfig*.json` | 2 |
| H-27…H-33 | `soniq-svelte/**`, `wasm-engine/**` | 3 |
| H-34…H-35 | root / `.github/workflows/**` | 4 |
| M-01…M-28 | various | 2–5 |
| L-01…L-20 | various | 5 |

---

*Generated from a full-source audit on 2026-05-12.*
*Repo: `/home/krishnanantha/crazyshiz/technosnizin`.*
*Last commit at audit time: see `git log -1`.*
