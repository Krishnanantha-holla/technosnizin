# SONIQ — Music Instrument Detection & Visualization Platform

A full-stack application for uploading audio files, separating stems, detecting instruments, analyzing genre/BPM/key, and visualizing results in real-time.

## Project Structure

```
technosnizin/
├── soniq-backend/      (FastAPI + Celery + PostgreSQL + Redis)
└── soniq-frontend/     (React + Vite + TypeScript + Radix UI)
```

## Quick Start

### Backend

```bash
cd soniq-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Update .env with your Spotify credentials
docker compose up postgres redis -d
alembic upgrade head
python scripts/download_models.py
uvicorn app.main:app --reload --port 8000
```

In another terminal (same venv):
```bash
celery -A celery_worker worker --loglevel=info --concurrency=1
```

### Frontend

```bash
cd soniq-frontend
npm install
# Update .env if needed (API endpoint)
npm run dev
```

Frontend will be available at `http://127.0.0.1:5173`

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript + Radix UI + Tailwind |
| Backend | FastAPI + Celery + PostgreSQL + Redis |
| ML | Demucs (stem separation) + librosa (analysis) |
| Auth | Spotify OAuth + JWT |
| Real-time | WebSocket |

## Environment Setup

### Backend

See `soniq-backend/.env.example` for all backend variables.

Key notes:
- Spotify redirect URI must use loopback IP: `http://127.0.0.1:3000/api/auth/callback/spotify`
- For production, use HTTPS redirect URIs

### Frontend

Environment variables typically in `.env` (create from `.env.example` if it exists):
- `VITE_API_URL` — Backend API URL (default: `http://127.0.0.1:8000`)

## API Endpoints

- `POST /api/analyze` — Upload audio file
- `WS /ws/{job_id}` — Stream progress and results
- `GET /api/metadata/{job_id}` — Get analysis metadata
- `GET /api/health` — Health check
- `POST /api/auth/spotify/callback` — Spotify OAuth callback

## Development

### Running Tests

Backend:
```bash
cd soniq-backend
pytest tests/ -v
```

Frontend:
```bash
cd soniq-frontend
npm run test
```

### Building for Production

Backend (Docker):
```bash
cd soniq-backend
docker compose -f docker-compose.prod.yml up
```

Frontend:
```bash
cd soniq-frontend
npm run build
```

## Documentation

- [Backend README](./soniq-backend/README.md)
- [Frontend README](./soniq-frontend/README.md)

## License

Proprietary — SONIQ Project
