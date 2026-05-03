import json

import pytest


@pytest.mark.asyncio
async def test_websocket_job_not_found(async_client):
    async with async_client.websocket_connect("/ws/does-not-exist") as ws:
        message = await ws.receive_json()
        assert message["type"] == "error"


@pytest.mark.asyncio
async def test_websocket_done_flow(async_client, monkeypatch):
    from app.api import websocket as ws_api

    async def fake_hgetall(key):
        _ = key
        return {"status": "done", "progress": "100", "stage": "done"}

    async def fake_get(key):
        _ = key
        return json.dumps(
            {
                "duration": 10.0,
                "genre": "Pop",
                "bpm": 120.0,
                "key": "C Major",
                "energy": 0.5,
                "frames": [],
            }
        )

    monkeypatch.setattr(ws_api.async_redis_client, "hgetall", fake_hgetall)
    monkeypatch.setattr(ws_api.async_redis_client, "get", fake_get)

    async with async_client.websocket_connect("/ws/test-job") as ws:
        progress = await ws.receive_json()
        assert progress["type"] == "progress"
        result = await ws.receive_json()
        assert result["type"] == "result"
        assert result["data"]["genre"] == "Pop"
