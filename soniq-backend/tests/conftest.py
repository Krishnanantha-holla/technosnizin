"""
Test configuration — fully mocked, no real DB or Celery required.

Strategy: override FastAPI's dependency injection for get_db so no
real Postgres connection is ever attempted.
"""
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest
import soundfile as sf

# Set a dummy DB URL before any app module is imported so SQLAlchemy
# doesn't try to connect during engine creation.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://soniq:soniq@localhost:5432/soniq_test",
)
os.environ.setdefault("SECRET_KEY", "ci-test-secret-key-minimum-32-chars-long-enough")
os.environ.setdefault("SPOTIFY_CLIENT_ID", "test")
os.environ.setdefault("SPOTIFY_CLIENT_SECRET", "test")
os.environ.setdefault("SPOTIFY_REDIRECT_URI", "http://localhost/callback")

from httpx import ASGITransport, AsyncClient  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

from app.database import get_db  # noqa: E402
from app.main import app  # noqa: E402


# ── DB mock ───────────────────────────────────────────────────────────────────
def make_mock_session(scalar_return=None):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = scalar_return

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    session.close = AsyncMock()
    return session


async def _fake_get_db():
    session = make_mock_session()
    # refresh() must populate job.id so AnalyzeResponse validates
    async def fake_refresh(obj):
        if not getattr(obj, "id", None):
            obj.id = "test-job-id-1234"
    session.refresh = fake_refresh
    yield session


# Override get_db globally for all tests — no real Postgres needed
app.dependency_overrides[get_db] = _fake_get_db


# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
def sync_client():
    return TestClient(app)


@pytest.fixture
def sample_wav(tmp_path: Path) -> Path:
    sr = 22050
    seconds = 10
    t = np.linspace(0, seconds, sr * seconds, endpoint=False)
    y = 0.2 * np.sin(2 * np.pi * 440 * t)
    path = tmp_path / "sample.wav"
    sf.write(path, y, sr)
    return path
