import asyncio
import json

from celery import Celery
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.ml.pipeline import AnalysisPipeline
from app.models.job import Job, JobStatus
from app.models.result import AnalysisResult
from app.services.cache import redis_client

celery_app = Celery("soniq", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_time_limit=900,
    task_soft_time_limit=600,
)

pipeline = AnalysisPipeline(model=settings.DEMUCS_MODEL, device=settings.DEMUCS_DEVICE)


async def _update_job(job_id: str, **kwargs) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            return

        for key, value in kwargs.items():
            setattr(job, key, value)
        await db.commit()


async def _save_result(job_id: str, data: dict) -> None:
    async with AsyncSessionLocal() as db:
        result = AnalysisResult(
            job_id=job_id,
            duration=data["duration"],
            genre=data["genre"],
            bpm=data["bpm"],
            key=data["key"],
            energy=data["energy"],
            frames_json=json.dumps(data["frames"]),
        )
        db.add(result)
        await db.flush()

        job_query = await db.execute(select(Job).where(Job.id == job_id))
        job = job_query.scalar_one_or_none()
        if job:
            job.result_id = result.id
            job.status = JobStatus.done
            job.progress = 100
            job.stage = "done"
            job.error_message = None

        await db.commit()


@celery_app.task(bind=True, name="analyze_audio")
def analyze_task(self, job_id: str, file_path: str) -> dict:
    def update_progress(percent: int, stage: str) -> None:
        redis_client.hset(
            f"job:{job_id}",
            mapping={
                "status": "processing" if percent < 100 else "done",
                "progress": percent,
                "stage": stage,
            },
        )
        asyncio.run(_update_job(job_id, status=JobStatus.processing if percent < 100 else JobStatus.done, progress=percent, stage=stage))

    try:
        redis_client.hset(f"job:{job_id}", mapping={"status": "processing", "progress": 0, "stage": "starting"})
        asyncio.run(_update_job(job_id, status=JobStatus.processing, progress=0, stage="starting"))

        result = pipeline.run(file_path, update_progress)

        redis_client.setex(f"result:{job_id}", 86400, json.dumps(result))
        redis_client.hset(f"job:{job_id}", mapping={"status": "done", "progress": 100, "stage": "done"})

        asyncio.run(_save_result(job_id, result))
        return {"status": "done", "job_id": job_id}

    except Exception as exc:
        message = str(exc)
        redis_client.hset(
            f"job:{job_id}",
            mapping={
                "status": "failed",
                "progress": 0,
                "stage": "error",
                "error": message,
            },
        )
        asyncio.run(_update_job(job_id, status=JobStatus.failed, stage="error", error_message=message))
        raise
