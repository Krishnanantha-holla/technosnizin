"""
WebSocket endpoint for real-time job progress.

Security [C-04]: requires a valid JWT passed as ?token= query param.
Performance [H-10]: uses Redis pub/sub instead of 500 ms polling.
"""
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.models.result import AnalysisResult
from app.services.cache import async_redis_client
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: str | None, job_id: str) -> bool:
    """Validate JWT and verify the job belongs to this user (or is anonymous)."""
    if not token:
        # Allow anonymous jobs (user_id IS NULL) without a token
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()
        return job is not None and job.user_id is None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        return False

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

    if not job:
        return False
    # Allow if job is anonymous OR belongs to this user
    return job.user_id is None or job.user_id == user_id


@router.websocket("/ws/{job_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    job_id: str,
    token: str | None = Query(default=None),
) -> None:
    # Auth check before accepting [C-04]
    if not await _authenticate_ws(token, job_id):
        await websocket.close(code=4001)
        return

    await manager.connect(job_id, websocket)

    try:
        # Use Redis pub/sub for zero-latency progress updates [H-10]
        pubsub = async_redis_client.pubsub()
        await pubsub.subscribe(f"job:{job_id}:progress")

        # Send current state immediately so client doesn't wait for first publish
        job_data = await async_redis_client.hgetall(f"job:{job_id}")
        if job_data:
            await websocket.send_json({
                "type": "progress",
                "percent": int(job_data.get("progress", 0)),
                "stage": job_data.get("stage", ""),
            })

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue

            data = json.loads(message["data"])
            msg_type = data.get("type", "progress")

            if msg_type == "progress":
                await websocket.send_json({
                    "type": "progress",
                    "percent": data.get("percent", 0),
                    "stage": data.get("stage", ""),
                })

            elif msg_type == "done":
                # Fetch result from Redis cache or DB
                result_json = await async_redis_client.get(f"result:{job_id}")
                if result_json:
                    await websocket.send_json({"type": "result", "data": json.loads(result_json)})
                else:
                    async with AsyncSessionLocal() as db:
                        row = await db.execute(
                            select(AnalysisResult).where(AnalysisResult.job_id == job_id)
                        )
                        record = row.scalar_one_or_none()
                    if record:
                        await websocket.send_json({
                            "type": "result",
                            "data": {
                                "duration": record.duration,
                                "genre": record.genre,
                                "bpm": record.bpm,
                                "key": record.key,
                                "energy": record.energy,
                                "frames": json.loads(record.frames_json),
                            },
                        })
                    else:
                        await websocket.send_json({"type": "error", "message": "Result not found"})
                break

            elif msg_type == "error":
                await websocket.send_json({"type": "error", "message": data.get("message", "Unknown error")})
                break

        await pubsub.unsubscribe(f"job:{job_id}:progress")

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(job_id)
