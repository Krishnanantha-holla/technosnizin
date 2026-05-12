"""
Metadata endpoint — returns genre/bpm/key/energy for a completed job.

[H-09] Removed dead json.loads(record.frames_json) that parsed and discarded frames.
       Added separate /frames/{job_id} endpoint for clients that need frame data.
"""
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

    return MetadataResponse(genre=record.genre, bpm=record.bpm, key=record.key, energy=record.energy)


@router.get("/frames/{job_id}")
async def get_frames(job_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Return the full per-frame energy data for a completed job."""
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

    return {"job_id": job_id, "frames": json.loads(record.frames_json)}
