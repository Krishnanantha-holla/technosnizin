"""
API tests — fully mocked via dependency_overrides, no real DB or Celery.
"""
from io import BytesIO
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_upload_non_audio_rejected(async_client):
    """Non-audio MIME type → 415."""
    payload = BytesIO(b"not-audio")
    response = await async_client.post(
        "/api/analyze",
        files={"file": ("sample.txt", payload, "text/plain")},
    )
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_upload_audio_accepts(async_client, sample_wav, monkeypatch):
    """Valid WAV upload → 200 with job_id."""
    async def fake_save(upload):
        return str(sample_wav)

    from app.api import analyze as analyze_api
    monkeypatch.setattr(analyze_api.storage_service, "save", fake_save)

    # Patch celery_app.send_task so no Redis connection is attempted
    with patch("app.tasks.analyze_task.celery_app") as mock_celery:
        mock_celery.send_task = MagicMock()
        with sample_wav.open("rb") as f:
            response = await async_client.post(
                "/api/analyze",
                files={"file": ("sample.wav", f, "audio/wav")},
            )

    assert response.status_code == 200
    assert "job_id" in response.json()


@pytest.mark.asyncio
async def test_metadata_not_found(async_client):
    """Unknown job_id → 404 (mock session returns None)."""
    response = await async_client.get(f"/api/metadata/{uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_health(async_client):
    response = await async_client.get("/api/health")
    assert response.status_code == 200
