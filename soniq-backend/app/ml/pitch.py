from typing import Any

import librosa
import numpy as np


class PitchDetector:
    def detect(self, file_path: str) -> dict[str, Any]:
        y, sr = librosa.load(file_path, sr=22050, mono=True, duration=60)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)

        dominant: list[float] = []
        for frame_idx in range(pitches.shape[1]):
            mags = magnitudes[:, frame_idx]
            if mags.size == 0:
                continue
            peak_idx = int(np.argmax(mags))
            freq = float(pitches[peak_idx, frame_idx])
            if freq > 0:
                dominant.append(freq)

        if not dominant:
            return {"dominant_note": "Unknown", "mean_hz": 0.0}

        mean_hz = float(np.mean(dominant))
        note = librosa.hz_to_note(mean_hz)
        return {"dominant_note": note, "mean_hz": round(mean_hz, 2)}
