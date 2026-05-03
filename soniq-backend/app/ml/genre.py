import librosa
import numpy as np


GENRE_HEURISTICS = [
    ((60, 90), (0.1, 0.4), (0, 2000), "Jazz"),
    ((60, 80), (0.1, 0.3), (0, 1500), "Classical"),
    ((80, 110), (0.3, 0.6), (1000, 3000), "R&B"),
    ((85, 110), (0.4, 0.7), (1500, 3500), "Hip-Hop"),
    ((100, 130), (0.5, 0.8), (2000, 5000), "Pop"),
    ((110, 140), (0.6, 0.9), (3000, 8000), "Electronic"),
    ((120, 180), (0.7, 1.0), (2000, 6000), "Rock"),
    ((130, 180), (0.8, 1.0), (4000, 10000), "Metal"),
    ((60, 100), (0.2, 0.5), (500, 2000), "Acoustic"),
]


class GenreDetector:
    def analyze(self, file_path: str) -> dict:
        y, sr = librosa.load(file_path, sr=22050, mono=True, duration=60)

        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo)

        chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chromagram, axis=1)
        key_idx = int(np.argmax(chroma_mean))
        note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

        key_str = f"{note_names[key_idx]} Major"

        rms = librosa.feature.rms(y=y)
        energy = float(np.mean(rms))
        energy_normalized = float(np.clip(energy * 10, 0.0, 1.0))

        centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

        genre = self._classify_genre(bpm, energy_normalized, centroid)

        return {
            "genre": genre,
            "bpm": round(bpm, 1),
            "key": key_str,
            "energy": round(energy_normalized, 2),
        }

    def _classify_genre(self, bpm: float, energy: float, centroid: float) -> str:
        best_match = "Unknown"
        best_score = -1

        for bpm_range, energy_range, centroid_range, genre in GENRE_HEURISTICS:
            bpm_score = 1.0 if bpm_range[0] <= bpm <= bpm_range[1] else 0.0
            energy_score = 1.0 if energy_range[0] <= energy <= energy_range[1] else 0.0
            centroid_score = 1.0 if centroid_range[0] <= centroid <= centroid_range[1] else 0.0
            score = bpm_score + energy_score + centroid_score
            if score > best_score:
                best_score = score
                best_match = genre

        return best_match
