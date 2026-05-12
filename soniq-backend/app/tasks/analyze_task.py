"""
Celery task for audio analysis.

Fixes applied:
[H-04] Single event loop per task — no asyncio.run() per progress tick.
[H-05] Uses demucs.api.Separator held at worker boot — no subprocess overhead.
"""
import asyncio
import json
import logging

from celery import Celery
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.ml.pipeline import AnalysisPipeline
from app.models.job import Job, JobStatus
from app.models.result import AnalysisResult
from app.services.cache import redis_client

logger = logging.getLogger(__name__)

celery_app = Celery("soniq", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_time_limit=900,
    task_soft_time_limit=600,
)

# Pipeline held at worker boot — Demucs model loaded once [H-05]
pipeline = AnalysisPipeline(model=settings.DEMUCS_MODEL, device=settings.DEMUCS_DEVICE)


def _publish_progress(job_id: str, percent: int, stage: str) -> None:
    """Write to Redis hash AND publish on pub/sub channel for WebSocket [H-10]."""
    mapping = {
        "status": "processing" if percent < 100 else "done",
        "progress": percent,
        "stage": stage,
    }
    redis_client.hset(f"job:{job_id}", mapping=mapping)
    redis_client.publish(
        f"job:{job_id}:progress",
        json.dumps({"type": "progress", "percent": percent, "stage": stage}),
    )


async def _update_job_async(loop: asyncio.AbstractEventLoop, job_id: str, **kwargs) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job:
            for key, value in kwargs.items():
                setattr(job, key, value)
            await db.commit()


async def _save_result_async(job_id: str, data: dict) -> None:
    async with AsyncSessionLocal() as db:
        record = AnalysisResult(
            job_id=job_id,
            duration=data["duration"],
            genre=data["genre"],
            bpm=data["bpm"],
            key=data["key"],
            energy=data["energy"],
            frames_json=json.dumps(data["frames"]),
        )
        db.add(record)
        await db.flush()

        job_query = await db.execute(select(Job).where(Job.id == job_id))
        job = job_query.scalar_one_or_none()
        if job:
            job.result_id = record.id
            job.status = JobStatus.done
            job.progress = 100
            job.stage = "done"
            job.error_message = None
        await db.commit()


@celery_app.task(bind=True, name="analyze_audio")
def analyze_task(self, job_id: str, file_path: str) -> dict:
    # Single event loop for the entire task lifetime [H-04]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def update_progress(percent: int, stage: str) -> None:
        _publish_progress(job_id, percent, stage)
        loop.run_until_complete(
            _update_job_async(
                loop, job_id,
                status=JobStatus.processing if percent < 100 else JobStatus.done,
                progress=percent,
                stage=stage,
            )
        )

    try:
        _publish_progress(job_id, 0, "starting")
        loop.run_until_complete(
            _update_job_async(loop, job_id, status=JobStatus.processing, progress=0, stage="starting")
        )

        result = pipeline.run(file_path, update_progress)

        redis_client.setex(f"result:{job_id}", 86400, json.dumps(result))
        _publish_progress(job_id, 100, "done")
        # Publish "done" event so WebSocket pub/sub listener exits
        redis_client.publish(
            f"job:{job_id}:progress",
            json.dumps({"type": "done"}),
        )

        loop.run_until_complete(_save_result_async(job_id, result))
        return {"status": "done", "job_id": job_id}

    except Exception as exc:
        message = str(exc)
        logger.exception("analyze_task failed for job %s", job_id)
        redis_client.hset(
            f"job:{job_id}",
            mapping={"status": "failed", "progress": 0, "stage": "error", "error": message},
        )
        redis_client.publish(
            f"job:{job_id}:progress",
            json.dumps({"type": "error", "message": message}),
        )
        loop.run_until_complete(
            _update_job_async(loop, job_id, status=JobStatus.failed, stage="error", error_message=message)
        )
        raise
    finally:
        loop.close()
