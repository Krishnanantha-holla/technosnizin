# Lazy imports — ML deps (torch, demucs, librosa) are only loaded when actually used.
# This keeps test startup fast and avoids import errors in environments without GPU deps.
from __future__ import annotations

__all__ = ["AnalysisPipeline"]


def __getattr__(name: str):
    if name == "AnalysisPipeline":
        from app.ml.pipeline import AnalysisPipeline
        return AnalysisPipeline
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
