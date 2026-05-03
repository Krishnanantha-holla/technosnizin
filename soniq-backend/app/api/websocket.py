import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.job import Job
from app.models.result import AnalysisResult
from app.services.cache import async_redis_client
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str) -> None:
    await manager.connect(job_id, websocket)

    try:
        last_progress = -1

        while True:
            job_data = await async_redis_client.hgetall(f"job:{job_id}")

            if not job_data:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(Job).where(Job.id == job_id))
                    job = result.scalar_one_or_none()
                if not job:
                    await websocket.send_json({"type": "error", "message": "Job not found"})
                    break
                job_data = {
                    "status": job.status.value,
                    "progress": str(job.progress),
                    "stage": job.stage or "",
                    "error": job.error_message or "",
                }

            status = job_data.get("status", "pending")
            progress = int(job_data.get("progress", 0))
            stage = job_data.get("stage", "")

            if progress != last_progress:
                await websocket.send_json({"type": "progress", "percent": progress, "stage": stage})
                last_progress = progress

            if status == "done":
                result_json = await async_redis_client.get(f"result:{job_id}")
                if result_json:
                    result = json.loads(result_json)
                    await websocket.send_json({"type": "result", "data": result})
                    break

                async with AsyncSessionLocal() as db:
                    result_row = await db.execute(select(AnalysisResult).where(AnalysisResult.job_id == job_id))
                    record = result_row.scalar_one_or_none()
                if not record:
                    await websocket.send_json({"type": "error", "message": "Result not found"})
                    break

                await websocket.send_json(
                    {
                        "type": "result",
                        "data": {
                            "duration": record.duration,
                            "genre": record.genre,
                            "bpm": record.bpm,
                            "key": record.key,
                            "energy": record.energy,
                            "frames": json.loads(record.frames_json),
                        },
                    }
                )
                break

            if status == "failed":
                error = job_data.get("error", "Unknown error")
                await websocket.send_json({"type": "error", "message": f"Analysis failed: {error}"})
                break

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(job_id)
