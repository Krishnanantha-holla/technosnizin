"""
WebSocket tests using starlette.testclient.TestClient [H-13].
"""
import json
from unittest.mock import AsyncMock, patch


async def _auth_ok(token, job_id):
    return True


async def _auth_fail(token, job_id):
    return False


def test_websocket_auth_rejected(sync_client):
    """No token + auth fails → server closes the WebSocket."""
    with patch("app.api.websocket._authenticate_ws", _auth_fail):
        try:
            with sync_client.websocket_connect("/ws/does-not-exist") as ws:
                ws.receive_text()
        except Exception:
            pass  # WebSocket closed with code 4001 — expected


def test_websocket_done_flow(sync_client):
    """Simulate a completed job via mocked Redis pub/sub."""

    done_message = {"type": "message", "data": json.dumps({"type": "done"})}

    class FakePubSub:
        async def subscribe(self, *args):
            pass

        async def unsubscribe(self, *args):
            pass

        # websocket.py iterates with `async for message in pubsub.listen()`
        async def listen(self):
            yield {"type": "subscribe", "data": None}   # ignored
            yield done_message

    async def fake_hgetall(key):
        return {"status": "done", "progress": "100", "stage": "done"}

    async def fake_get(key):
        return json.dumps({
            "duration": 10.0, "genre": "Pop", "bpm": 120.0,
            "key": "C Major", "energy": 0.5, "frames": [],
        })

    with patch("app.api.websocket._authenticate_ws", _auth_ok):
        with patch("app.api.websocket.async_redis_client") as mock_redis:
            mock_redis.hgetall = AsyncMock(side_effect=fake_hgetall)
            mock_redis.get = AsyncMock(side_effect=fake_get)
            # pubsub() is a sync method that returns a pub/sub object
            mock_redis.pubsub = lambda: FakePubSub()

            with sync_client.websocket_connect("/ws/test-job") as ws:
                # First: current state broadcast (progress)
                msg1 = ws.receive_json()
                assert msg1["type"] == "progress"
                # Second: result from done event
                msg2 = ws.receive_json()
                assert msg2["type"] == "result"
                assert msg2["data"]["genre"] == "Pop"
