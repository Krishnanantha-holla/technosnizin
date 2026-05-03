import librosa
import numpy as np

from app.ml.utils import compute_energy, load_audio, split_into_frames


class InstrumentClassifier:
    def classify_stem(self, stem_path: str, stem_name: str) -> list[float]:
        _ = stem_name
        y, sr = load_audio(stem_path)
        frames = split_into_frames(y, sr)
        return [compute_energy(frame) for frame in frames]

    def classify_other_stem(self, other_stem_path: str) -> dict[str, list[float]]:
        y, sr = load_audio(other_stem_path)
        frames = split_into_frames(y, sr)

        guitar_energies: list[float] = []
        keys_energies: list[float] = []

        for frame in frames:
            if len(frame) < 512:
                guitar_energies.append(0.0)
                keys_energies.append(0.0)
                continue

            energy = compute_energy(frame)
            zcr = float(np.mean(librosa.feature.zero_crossing_rate(frame)))

            guitar_score = min(1.0, zcr * 20.0) * energy
            keys_score = max(0.0, 1.0 - zcr * 15.0) * energy

            guitar_energies.append(float(np.clip(guitar_score, 0.0, 1.0)))
            keys_energies.append(float(np.clip(keys_score, 0.0, 1.0)))

        return {"guitar": guitar_energies, "keys": keys_energies}
