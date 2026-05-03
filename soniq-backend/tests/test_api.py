from io import BytesIO
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_upload_non_audio_rejected(async_client):
    payload = BytesIO(b"not-audio")
    response = await async_client.post(
        "/api/analyze",
        files={"file": ("sample.txt", payload, "text/plain")},
    )
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_upload_audio_accepts(async_client, sample_wav, monkeypatch):
    async def fake_save(upload):
        _ = upload
        return str(sample_wav)

    called = {}

    def fake_delay(job_id, file_path):
        called["job_id"] = job_id
        called["file_path"] = file_path

    from app.api import analyze as analyze_api

    monkeypatch.setattr(analyze_api.storage_service, "save", fake_save)
    monkeypatch.setattr(analyze_api.analyze_task, "delay", fake_delay)

    with sample_wav.open("rb") as f:
        response = await async_client.post(
            "/api/analyze",
            files={"file": ("sample.wav", f, "audio/wav")},
        )

    assert response.status_code == 200
    body = response.json()
    assert "job_id" in body
    assert called["job_id"] == body["job_id"]
    assert called["file_path"] == str(sample_wav)


@pytest.mark.asyncio
async def test_metadata_not_found(async_client):
    response = await async_client.get(f"/api/metadata/{uuid4()}")
    assert response.status_code == 404
