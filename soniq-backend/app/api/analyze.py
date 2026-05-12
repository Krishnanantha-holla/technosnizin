from __future__ import annotations

import io
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.auth import get_current_user, get_optional_user
from app.config import settings
from app.database import get_db
from app.models.job import Job, JobStatus
from app.models.user import User
from app.schemas.job import AnalyzeResponse
from app.services.storage import storage_service
from app.tasks.analyze_task import analyze_task

router = APIRouter(prefix="/api", tags=["analyze"])

# Magic bytes for common audio containers [H-03]
_AUDIO_MAGIC: list[tuple[bytes, str]] = [
    (b"ID3",           "mp3"),
    (b"\xff\xfb",      "mp3"),
    (b"\xff\xf3",      "mp3"),
    (b"\xff\xf2",      "mp3"),
    (b"RIFF",          "wav"),   # followed by WAVE at offset 8
    (b"fLaC",          "flac"),
    (b"OggS",          "ogg"),
    (b"\x00\x00\x00",  "m4a"),   # ftyp box — checked more carefully below
]

_ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"}


def _check_magic(header: bytes) -> bool:
    """Return True if header bytes match a known audio container."""
    for magic, _ in _AUDIO_MAGIC:
        if header[:len(magic)] == magic:
            return True
    # M4A / AAC: ftyp box at offset 4
    if len(header) >= 8 and header[4:8] in (b"ftyp", b"M4A ", b"mp42", b"isom"):
        return True
    return False


async def _validate_audio_file(file: UploadFile, saved_path: str) -> None:
    """Validate extension, magic bytes, and duration. [H-01][H-02][H-03]"""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Unsupported audio format: {suffix}")

    # S3: stream first 16 bytes for magic check instead of skipping [H-02]
    if saved_path.startswith("s3://"):
        # Read the first chunk already buffered in the UploadFile
        header = await file.read(16)
        await file.seek(0)
        if not _check_magic(header):
            raise HTTPException(status_code=415, detail="File does not appear to be a valid audio file")
        return

    # Local: read header from saved file [H-03]
    try:
        with open(saved_path, "rb") as fh:
            header = fh.read(16)
        if not _check_magic(header):
            raise HTTPException(status_code=415, detail="File does not appear to be a valid audio file")

        # Use soundfile.info — no decoding, instant [H-01]
        info = await run_in_threadpool(sf.info, saved_path)
        duration = info.duration
        if duration > settings.MAX_AUDIO_DURATION:
            raise HTTPException(
                status_code=422,
                detail=f"Audio exceeds maximum duration of {settings.MAX_AUDIO_DURATION}s",
            )
        if duration < 0.5:
            raise HTTPException(status_code=422, detail="Audio file is too short (< 0.5s)")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="File appears to be corrupted or not a valid audio file",
        ) from exc


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_audio(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    # Auth: optional — anonymous uploads allowed but rate-limited at middleware [C-03]
    current_user: User | None = Depends(get_optional_user),
) -> AnalyzeResponse:
    # Enforce Content-Length before reading [C-03]
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB} MB",
        )

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
