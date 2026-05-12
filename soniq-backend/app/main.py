from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.analyze import router as analyze_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.metadata import router as metadata_router
from app.api.websocket import router as websocket_router
from app.config import settings

# Rate limiter — 10 uploads/hour per IP for anonymous, enforced in analyze.py [C-03]
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="SONIQ API", version=settings.API_VERSION)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
