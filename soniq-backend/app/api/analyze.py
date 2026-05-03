from __future__ import annotations

from pathlib import Path

import librosa
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.auth import get_optional_user
from app.config import settings
from app.database import get_db
from app.models.job import Job, JobStatus
from app.models.user import User
from app.schemas.job import AnalyzeResponse
from app.services.storage import storage_service
from app.tasks.analyze_task import analyze_task

router = APIRouter(prefix="/api", tags=["analyze"])


async def _validate_audio_file(file: UploadFile, saved_path: str) -> None:
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("audio/"):
        raise HTTPException(status_code=415, detail="Unsupported media type. Expected audio/*")

    suffix = Path(file.filename or "").suffix.lower()
    allowed = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"}
    if suffix and suffix not in allowed:
        raise HTTPException(status_code=415, detail="Unsupported audio format")

    if saved_path.startswith("s3://"):
        return

    try:
        y, sr = await run_in_threadpool(librosa.load, saved_path, 22050, True, 0.0, 5.0)
        if y.size == 0:
            raise ValueError("Empty decoded waveform")
        full_y, full_sr = await run_in_threadpool(librosa.load, saved_path, 22050, True)
        duration = float(len(full_y) / full_sr) if full_sr else 0.0
        if duration > settings.MAX_AUDIO_DURATION:
            raise HTTPException(
                status_code=422,
                detail=f"Audio exceeds maximum duration of {settings.MAX_AUDIO_DURATION} seconds",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="File appears to be corrupted or not a valid audio file",
        ) from exc


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_audio(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> AnalyzeResponse:
    file_path = await storage_service.save(file)
    await _validate_audio_file(file, file_path)

    job = Job(
        status=JobStatus.pending,
        progress=0,
        stage="queued",
        file_path=file_path,
        user_id=current_user.id if current_user else None,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    analyze_task.delay(job.id, file_path)
    return AnalyzeResponse(job_id=job.id)
