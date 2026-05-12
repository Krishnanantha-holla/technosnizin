# Lazy imports — Celery + ML pipeline only loaded when the worker process starts.
from __future__ import annotations

__all__ = ["celery_app", "analyze_task"]


def __getattr__(name: str):
    if name in ("celery_app", "analyze_task"):
        from app.tasks.analyze_task import analyze_task, celery_app
        return analyze_task if name == "analyze_task" else celery_app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
