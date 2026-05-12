# SONIQ — Post-Fix Report

Generated after applying FIX_PROMPT.md phases 0–4.

## What Changed

### Phase 0 — Secrets & Git Hygiene ✅
- `soniq-backend/.env` untracked from git (`git rm --cached`)
- Real Spotify credentials replaced with placeholders — **rotate in Spotify Dashboard**
- New `SECRET_KEY` generated (48-char urlsafe token)
- All `.env.example` files scrubbed to placeholder values only
- `soniq-backend/.gitignore` rewritten to properly exclude `.env`, `uploads/`, `venv/`, etc.
- `soniq-frontend/.gitignore` updated: excludes `dist/`, `bun.lockb`, `.lovable/`
- `soniq-svelte/.gitignore` created: excludes `.svelte-kit/`, `build/`, `wasm-engine/target/`
- `bun.lockb` untracked from git
- Nested `.git` inside `wasm-engine/` removed
- `.pre-commit-config.yaml` added (gitleaks, detect-secrets, ruff, mypy, eslint, prettier)
- `soniq-svelte/src/routes/+layout.ts` added: `prerender=false; ssr=false` for SPA mode

### Phase 1 — Backend Security & Correctness ✅
- **[C-03]** `analyze.py`: Content-Length guard, magic-byte validation via `_check_magic()`, `soundfile.info` replaces double `librosa.load` — no more 2× decode
- **[C-04]** `websocket.py`: JWT auth via `?token=` query param; Redis pub/sub replaces 500ms polling
- **[H-04]** `analyze_task.py`: Single `asyncio.new_event_loop()` per task — no more 30 event loops per job
- **[H-05]** `separator.py`: `demucs.api.Separator` singleton at worker boot — subprocess fallback retained
- **[H-08]** `genre.py`: Krumhansl-Schmuckler profiles for both major AND minor keys
- **[H-09]** `metadata.py`: Dead `json.loads(frames_json)` removed; new `/api/frames/{job_id}` endpoint added
- **[H-11]** Dockerfiles: multi-stage, non-root (`soniq` user), `HEALTHCHECK` added
- **[H-12]** `docker-compose.yml`: Postgres/Redis bound to `127.0.0.1`; healthchecks added
- **[H-13]** `test_websocket.py`: Rewritten using `starlette.testclient.TestClient`
- **[H-14]** `conftest.py`: Deprecated `event_loop` fixture removed; `pyproject.toml` sets `asyncio_mode=auto`
- `main.py`: `slowapi` rate limiter added (200 req/min default)
- `auth.py`: `get_current_user` dependency added (raises 401); `get_optional_user` preserved
- `requirements.txt`: Added `python-magic`, `slowapi`; removed `essentia` (unused)

### Phase 2 — Frontend Fixes ✅
- **[H-17]** `AudioEngine.ts`: `WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>` cache — no double-wrap
- **[H-18]** `AudioEngine.ts`: `trackObjectUrl()` + `reset()` revoke object URLs
- **[H-19]** `dashboard/+page.svelte`: `loadedmetadata` wait has 10s timeout + error handler
- **[H-23]** `soniq-frontend/package.json`: renamed to `soniq-frontend`, version `1.0.0`
- **[H-25]** `bun.lockb` removed from git
- **[H-28]** `soniq-svelte/package.json`: `framer-motion` and `zustand` removed
- `axios` removed from `soniq-frontend` dependencies (unused)

### Phase 3 — Svelte Stabilization ✅
- **[H-27]** `+layout.svelte`: Migrated to Svelte 5 — `$props()`, `{@render children()}`, static `Toaster` import
- **[H-29]** Nested `wasm-engine/.git` removed
- **[H-30]** Rust `PREV_FREQ`: `unsafe static mut` replaced with `thread_local! { RefCell<Vec<f32>> }` — auto-grows, no fixed-size panic
- WASM rebuilt with fix

### Phase 4 — CI ✅
- `.github/workflows/ci.yml`: backend (pytest+ruff), frontend (lint+test+build), svelte (check+build), wasm (clippy+test+wasm-pack)
- `pyproject.toml` added to backend with ruff + mypy config

## Still Open (requires manual action)

| # | Action | Who |
|---|---|---|
| C-01 | **Rotate Spotify client secret** in Spotify Developer Dashboard | Developer |
| C-05 | Encrypt Spotify tokens at rest (Fernet column TypeDecorator) | Next sprint |
| C-06 | Replace deprecated `/audio-features` with backend librosa proxy | Next sprint |
| H-06/H-07 | Real `other` stem energy; Yamnet guitar/keys tagger | Next sprint |
| H-15/H-16 | Migrate String PKs to UUID; add FK indexes + CASCADE | Next sprint |
| H-22 | Enable TypeScript `strict` in React frontend | Next sprint |
| H-24 | Replace Lovable OG image; remove `.lovable/` from git | Developer |
| H-27 | Full Svelte 5 migration of all components (on:click → onclick etc.) | Next sprint |
| M-25 | Split 61KB `spotify/+page.svelte` into components | Next sprint |
| M-27 | Sentry + Prometheus observability | Next sprint |

## Reviewer Checklist
- [ ] Spotify credentials rotated in Dashboard
- [ ] `git log --all --full-history -- soniq-backend/.env` shows no secret values after purge
- [ ] `npm run build` passes in both frontends
- [ ] `cargo test` passes in `wasm-engine/`
- [ ] `pytest -q` passes in backend (with test DB)
- [ ] CI green on first push
