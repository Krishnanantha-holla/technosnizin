"""
Test configuration.
[H-14] Removed deprecated event_loop fixture override.
        asyncio_mode="auto" is set in pyproject.toml instead.
"""
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
def sync_client():
    """Synchronous test client — required for WebSocket tests [H-13]."""
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
