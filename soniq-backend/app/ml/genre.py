"""
Genre detection + key detection.

[H-08] Key detection now uses Krumhansl-Schmuckler profiles for both
major AND minor keys — previously always returned "X Major".
"""
from __future__ import annotations

import librosa
import numpy as np

GENRE_HEURISTICS = [
    ((60, 90),  (0.1, 0.4), (0, 2000),    "Jazz"),
    ((60, 80),  (0.1, 0.3), (0, 1500),    "Classical"),
    ((80, 110), (0.3, 0.6), (1000, 3000), "R&B"),
    ((85, 110), (0.4, 0.7), (1500, 3500), "Hip-Hop"),
    ((100, 130),(0.5, 0.8), (2000, 5000), "Pop"),
    ((110, 140),(0.6, 0.9), (3000, 8000), "Electronic"),
    ((120, 180),(0.7, 1.0), (2000, 6000), "Rock"),
    ((130, 180),(0.8, 1.0), (4000, 10000),"Metal"),
    ((60, 100), (0.2, 0.5), (500, 2000),  "Acoustic"),
]

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles [H-08]
_KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                       2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                       2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _detect_key(chroma_mean: np.ndarray) -> str:
    """Return key string like 'A Minor' or 'C# Major' using KS profiles."""
    best_key = 0
    best_mode = "Major"
    best_corr = -np.inf

    for root in range(12):
        rotated = np.roll(chroma_mean, -root)
        corr_major = float(np.corrcoef(rotated, _KS_MAJOR)[0, 1])
        corr_minor = float(np.corrcoef(rotated, _KS_MINOR)[0, 1])
        if corr_major > best_corr:
            best_corr = corr_major
            best_key = root
            best_mode = "Major"
        if corr_minor > best_corr:
            best_corr = corr_minor
            best_key = root
            best_mode = "Minor"

    return f"{NOTE_NAMES[best_key]} {best_mode}"


class GenreDetector:
    def analyze(self, file_path: str) -> dict:
        y, sr = librosa.load(file_path, sr=22050, mono=True, duration=60)

        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo)

        chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chromagram, axis=1)
        key_str = _detect_key(chroma_mean)

        rms = librosa.feature.rms(y=y)
        energy = float(np.clip(float(np.mean(rms)) * 10, 0.0, 1.0))

        centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        genre = self._classify_genre(bpm, energy, centroid)

        return {
            "genre": genre,
            "bpm": round(bpm, 1),
            "key": key_str,
            "energy": round(energy, 2),
        }

    def _classify_genre(self, bpm: float, energy: float, centroid: float) -> str:
        best_match = "Unknown"
        best_score = -1
        for bpm_range, energy_range, centroid_range, genre in GENRE_HEURISTICS:
            score = (
                (1.0 if bpm_range[0] <= bpm <= bpm_range[1] else 0.0)
                + (1.0 if energy_range[0] <= energy <= energy_range[1] else 0.0)
                + (1.0 if centroid_range[0] <= centroid <= centroid_range[1] else 0.0)
            )
            if score > best_score:
                best_score = score
                best_match = genre
        return best_match
