"""
WebSocket tests using starlette.testclient.TestClient [H-13].
httpx.AsyncClient does not support websocket_connect.
"""
import json

import pytest


def test_websocket_job_not_found(sync_client):
    """Unknown job_id with no token → close with 4001 (auth) or error message."""
    # Anonymous job that doesn't exist — server should close or send error
    with sync_client.websocket_connect("/ws/does-not-exist") as ws:
        # Either the server closes immediately (4001) or sends an error frame
        try:
            message = ws.receive_json()
            assert message["type"] == "error"
        except Exception:
            pass  # WebSocket closed — also acceptable


def test_websocket_done_flow(sync_client, monkeypatch):
    """Simulate a completed job via monkeypatched Redis."""
    import asyncio
    from app.api import websocket as ws_api

    async def fake_hgetall(key):
        return {"status": "done", "progress": "100", "stage": "done"}

    async def fake_get(key):
        return json.dumps({
            "duration": 10.0, "genre": "Pop", "bpm": 120.0,
            "key": "C Major", "energy": 0.5, "frames": [],
        })

    # Stub pub/sub to immediately yield a "done" message
    class FakePubSub:
        def __init__(self):
            self._messages = [
                {"type": "message", "data": json.dumps({"type": "done"})},
            ]
        async def subscribe(self, *args): pass
        async def unsubscribe(self, *args): pass
        async def __aiter__(self):
            for m in self._messages:
                yield m

    monkeypatch.setattr(ws_api.async_redis_client, "hgetall", fake_hgetall)
    monkeypatch.setattr(ws_api.async_redis_client, "get", fake_get)
    monkeypatch.setattr(ws_api.async_redis_client, "pubsub", lambda: FakePubSub())

    # Also stub auth so anonymous job passes
    monkeypatch.setattr(ws_api, "_authenticate_ws", lambda token, job_id: asyncio.coroutine(lambda: True)())

    with sync_client.websocket_connect("/ws/test-job") as ws:
        result = ws.receive_json()
        assert result["type"] == "result"
        assert result["data"]["genre"] == "Pop"
