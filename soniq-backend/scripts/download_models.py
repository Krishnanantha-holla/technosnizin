import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from app.config import settings


def main() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        test_wav = Path(tmpdir) / "ping.wav"
        sr = 44100
        audio = np.zeros(sr * 2, dtype=np.float32)
        audio[:2000] = 0.2
        sf.write(test_wav, audio, sr)

        cmd = [
            "python",
            "-m",
            "demucs.separate",
            "--name",
            settings.DEMUCS_MODEL,
            "--device",
            "cpu",
            "--two-stems",
            "vocals",
            "--out",
            tmpdir,
            str(test_wav),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise SystemExit(f"Model download failed: {result.stderr}")

        print("Demucs model is available")


if __name__ == "__main__":
    main()
