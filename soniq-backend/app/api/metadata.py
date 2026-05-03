import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.job import Job, JobStatus
from app.models.result import AnalysisResult
from app.schemas.job import MetadataResponse

router = APIRouter(prefix="/api", tags=["metadata"])


@router.get("/metadata/{job_id}", response_model=MetadataResponse)
async def get_metadata(job_id: str, db: AsyncSession = Depends(get_db)) -> MetadataResponse:
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.done:
        raise HTTPException(status_code=409, detail="Job is not complete yet")

    result_query = await db.execute(select(AnalysisResult).where(AnalysisResult.job_id == job_id))
    record = result_query.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Result not found")

    _ = json.loads(record.frames_json)

    return MetadataResponse(genre=record.genre, bpm=record.bpm, key=record.key, energy=record.energy)
