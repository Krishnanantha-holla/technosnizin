import os
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile

from app.config import settings


class StorageService:
    def __init__(self) -> None:
        self.backend = settings.STORAGE_BACKEND
        self.local_upload_dir = Path(settings.LOCAL_UPLOAD_DIR)
        self.local_upload_dir.mkdir(parents=True, exist_ok=True)

        self.s3_client = None
        if self.backend == "s3":
            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )

    async def save(self, upload: UploadFile) -> str:
        ext = Path(upload.filename or "audio").suffix or ".bin"
        key = f"audio/{uuid4()}{ext}"

        if self.backend == "local":
            target = self.local_upload_dir / key
            target.parent.mkdir(parents=True, exist_ok=True)
            total_bytes = 0
            max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

            with target.open("wb") as output:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        output.close()
                        target.unlink(missing_ok=True)
                        raise HTTPException(status_code=413, detail="File too large")
                    output.write(chunk)

            await upload.seek(0)
            return str(target)

        if self.backend == "s3":
            if not self.s3_client or not settings.AWS_BUCKET_NAME:
                raise HTTPException(status_code=500, detail="S3 is not configured")

            try:
                await upload.seek(0)
                self.s3_client.upload_fileobj(upload.file, settings.AWS_BUCKET_NAME, key)
                await upload.seek(0)
                return f"s3://{settings.AWS_BUCKET_NAME}/{key}"
            except (ClientError, BotoCoreError) as exc:
                raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {exc}") from exc

        raise HTTPException(status_code=500, detail="Unsupported storage backend")

    def resolve_local_path(self, file_path: str) -> str:
        if file_path.startswith("s3://"):
            raise ValueError("S3 objects are not directly readable by local loaders")
        return file_path


storage_service = StorageService()
