"""
Stem separator using demucs.api — loaded once at worker boot [H-05].
Eliminates the ~7s subprocess startup cost per job.
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Lazy singleton — initialised on first call so import doesn't block
_separator = None


def _get_separator(model: str, device: str):
    global _separator
    if _separator is None:
        try:
            from demucs.api import Separator  # type: ignore[import]
            logger.info("Loading Demucs model '%s' on device '%s'…", model, device)
            _separator = Separator(model=model, device=device)
            logger.info("Demucs model loaded.")
        except ImportError:
            logger.warning("demucs.api not available — falling back to subprocess")
            _separator = _SubprocessSeparator(model, device)
    return _separator


class StemSeparator:
    def __init__(self, model: str = "htdemucs", device: str = "cpu") -> None:
        self.model = model
        self.device = device

    def separate(self, input_path: str, output_dir: str) -> dict[str, str]:
        sep = _get_separator(self.model, self.device)
        return sep.separate(input_path, output_dir)


class _SubprocessSeparator:
    """Fallback for environments where demucs.api is unavailable."""

    def __init__(self, model: str, device: str) -> None:
        self.model = model
        self.device = device

    def separate(self, input_path: str, output_dir: str) -> dict[str, str]:
        import subprocess
        cmd = [
            "python", "-m", "demucs.separate",
            "--name", self.model,
            "--device", self.device,
            "--out", output_dir,
            "--mp3", input_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if result.returncode != 0:
            raise RuntimeError(f"Demucs failed: {result.stderr.strip()}")

        track_name = Path(input_path).stem
        stem_dir = Path(output_dir) / self.model / track_name
        stems: dict[str, str] = {}
        for stem in ["vocals", "drums", "bass", "other"]:
            stem_path = stem_dir / f"{stem}.mp3"
            if not stem_path.exists():
                raise FileNotFoundError(f"Expected stem not found: {stem_path}")
            stems[stem] = str(stem_path)
        return stems
