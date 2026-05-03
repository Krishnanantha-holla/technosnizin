# SONIQ Backend

Production-ready backend for SONIQ, a music instrument detection and visualization platform.

## Stack

- FastAPI + WebSocket
 Spotify OAuth variables (use a loopback IP literal or HTTPS)

- app: API routes, models, schemas, services, ML pipeline, websocket manager, celery tasks
- alembic: migration config and versions
- tests: API, websocket, and ML tests
- scripts: utility scripts for model prefetch and DB seeding
- docker: API/worker images and nginx config

## Environment

Copy `.env.example` to `.env` and set values:

- APP_ENV, SECRET_KEY, CORS_ORIGINS
- DATABASE_URL
- REDIS_URL
- STORAGE_BACKEND and local/S3 variables
- Spotify OAuth variables
- ML tuning variables

## Local Run

1. Create virtual env and install dependencies
2. Start Postgres and Redis
3. Run migrations
4. Prefetch Demucs model
5. Start API

### Spotify Redirect URI notes

- Spotify requires redirect URIs to be HTTPS unless they are loopback IP literals.
- Do not use `localhost` as the registered redirect URI — use an explicit loopback IP like `http://127.0.0.1:3000/api/auth/callback/spotify` for local development.
- If you expose your dev server via an HTTPS tunnel (ngrok, Cloudflare Tunnel), register the HTTPS callback URL provided by the tunnel.

After updating `.env` to set `SPOTIFY_REDIRECT_URI` to the exact value registered in your Spotify Developer Dashboard, restart the API/server so the new redirect URI is used by the OAuth flow.
6. Start Celery worker

Commands:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
docker compose up postgres redis -d
alembic upgrade head
python scripts/download_models.py
uvicorn app.main:app --reload --port 8000
```

Worker in another terminal:

```bash
celery -A celery_worker worker --loglevel=info --concurrency=1
```

## Endpoints

- POST /api/analyze
- WS /ws/{job_id}
- GET /api/metadata/{job_id}
- GET /api/health
- POST /api/auth/spotify/callback

## Test

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
pytest tests/ --cov=app --cov-report=html
```

## Production Notes

- Run API and worker as separate services
- Use GPU worker for faster Demucs throughput
- Use S3 + managed Redis + managed Postgres
- Put nginx or load balancer in front of API
