import numpy as np
import soundfile as sf

from app.ml.pipeline import AnalysisPipeline


def test_ml_pipeline_builds_frames(sample_wav, tmp_path, monkeypatch):
    pipeline = AnalysisPipeline()

    stems_dir = tmp_path / "stems"
    stems_dir.mkdir(parents=True, exist_ok=True)

    def fake_separate(input_path: str, output_dir: str):
        _ = output_dir
        stems = {}
        y = np.zeros(22050 * 10, dtype=np.float32)
        for name in ["vocals", "drums", "bass", "other"]:
            stem_path = stems_dir / f"{name}.wav"
            sf.write(stem_path, y, 22050)
            stems[name] = str(stem_path)
        return stems

    monkeypatch.setattr(pipeline.separator, "separate", fake_separate)

    progress_calls = []

    def progress(percent, stage):
        progress_calls.append((percent, stage))

    result = pipeline.run(str(sample_wav), progress)

    assert result["duration"] > 0
    assert result["genre"]
    assert 0 <= result["energy"] <= 1
    assert len(result["frames"]) > 0
    for frame in result["frames"]:
        assert 0 <= frame["bass"] <= 1
        assert 0 <= frame["drums"] <= 1
        assert 0 <= frame["guitar"] <= 1
        assert 0 <= frame["keys"] <= 1
        assert 0 <= frame["vocals"] <= 1
        assert 0 <= frame["other"] <= 1

    assert progress_calls[-1][0] == 100
