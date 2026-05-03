import tempfile
from collections.abc import Callable

from app.ml.classifier import InstrumentClassifier
from app.ml.genre import GenreDetector
from app.ml.pitch import PitchDetector
from app.ml.separator import StemSeparator
from app.ml.utils import FRAME_DURATION, load_audio


class AnalysisPipeline:
    def __init__(self, model: str = "htdemucs", device: str = "cpu") -> None:
        self.separator = StemSeparator(model=model, device=device)
        self.classifier = InstrumentClassifier()
        self.genre_detector = GenreDetector()
        self.pitch_detector = PitchDetector()

    def run(self, file_path: str, progress_callback: Callable[[int, str], None]) -> dict:
        progress_callback(5, "loading")
        y, sr = load_audio(file_path)
        duration = len(y) / sr

        progress_callback(10, "separating")
        with tempfile.TemporaryDirectory() as tmpdir:
            stems = self.separator.separate(file_path, tmpdir)

            progress_callback(50, "analyzing_genre")
            metadata = self.genre_detector.analyze(file_path)

            progress_callback(55, "detecting_pitch")
            pitch = self.pitch_detector.detect(file_path)

            progress_callback(60, "classifying")
            bass_energies = self.classifier.classify_stem(stems["bass"], "bass")
            drums_energies = self.classifier.classify_stem(stems["drums"], "drums")
            vocals_energies = self.classifier.classify_stem(stems["vocals"], "vocals")
            other_split = self.classifier.classify_other_stem(stems["other"])

            guitar_energies = other_split["guitar"]
            keys_energies = other_split["keys"]

            all_lists = [bass_energies, drums_energies, vocals_energies, guitar_energies, keys_energies]
            max_len = max((len(lst) for lst in all_lists), default=0)

            def pad(lst: list[float], n: int) -> list[float]:
                return lst + [0.0] * (n - len(lst))

            bass_energies = pad(bass_energies, max_len)
            drums_energies = pad(drums_energies, max_len)
            vocals_energies = pad(vocals_energies, max_len)
            guitar_energies = pad(guitar_energies, max_len)
            keys_energies = pad(keys_energies, max_len)

            progress_callback(85, "building_result")
            frames = []
            for i in range(max_len):
                timestamp = round(i * FRAME_DURATION, 3)
                other_energy = max(
                    0.0,
                    float(
                        (
                            bass_energies[i]
                            + drums_energies[i]
                            + vocals_energies[i]
                            + guitar_energies[i]
                            + keys_energies[i]
                        )
                        / 5
                        * 0.1
                    ),
                )

                frames.append(
                    {
                        "timestamp": timestamp,
                        "bass": round(bass_energies[i], 3),
                        "drums": round(drums_energies[i], 3),
                        "guitar": round(guitar_energies[i], 3),
                        "keys": round(keys_energies[i], 3),
                        "vocals": round(vocals_energies[i], 3),
                        "other": round(other_energy, 3),
                    }
                )

            progress_callback(95, "saving")
            result = {
                "duration": round(duration, 2),
                "genre": metadata["genre"],
                "bpm": metadata["bpm"],
                "key": metadata["key"],
                "energy": metadata["energy"],
                "pitch": pitch,
                "frames": frames,
            }
            progress_callback(100, "done")
            return result
