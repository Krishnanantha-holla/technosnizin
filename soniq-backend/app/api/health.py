from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.database import AsyncSessionLocal
from app.services.cache import async_redis_client

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health() -> dict:
    db_status = "ok"
    redis_status = "ok"

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        await async_redis_client.ping()
    except Exception:
        redis_status = "error"

    return {
        "status": "ok" if db_status == "ok" and redis_status == "ok" else "degraded",
        "version": settings.API_VERSION,
        "redis": redis_status,
        "db": db_status,
    }
