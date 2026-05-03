from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analyze import router as analyze_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.metadata import router as metadata_router
from app.api.websocket import router as websocket_router
from app.config import settings

app = FastAPI(title="SONIQ API", version=settings.API_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analyze_router)
app.include_router(metadata_router)
app.include_router(health_router)
app.include_router(websocket_router)
