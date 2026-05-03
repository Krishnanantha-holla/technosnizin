import subprocess
from pathlib import Path


class StemSeparator:
    def __init__(self, model: str = "htdemucs", device: str = "cpu") -> None:
        self.model = model
        self.device = device

    def separate(self, input_path: str, output_dir: str) -> dict[str, str]:
        cmd = [
            "python",
            "-m",
            "demucs.separate",
            "--name",
            self.model,
            "--device",
            self.device,
            "--out",
            output_dir,
            "--mp3",
            input_path,
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
