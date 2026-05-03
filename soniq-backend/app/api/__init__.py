from app.api.analyze import router as analyze_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.metadata import router as metadata_router
from app.api.websocket import router as websocket_router

__all__ = ["analyze_router", "auth_router", "health_router", "metadata_router", "websocket_router"]
