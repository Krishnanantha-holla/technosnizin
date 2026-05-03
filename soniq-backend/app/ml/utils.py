import librosa
import numpy as np

from app.config import settings


SAMPLE_RATE = 22050
FRAME_DURATION = settings.frame_duration_seconds


def load_audio(file_path: str) -> tuple[np.ndarray, int]:
    y, sr = librosa.load(file_path, sr=SAMPLE_RATE, mono=True)
    return y, sr


def split_into_frames(y: np.ndarray, sr: int, frame_duration: float = FRAME_DURATION) -> list[np.ndarray]:
    frame_length = int(sr * frame_duration)
    if frame_length <= 0:
        raise ValueError("Frame length must be greater than 0")
    if len(y) <= frame_length:
        return [y]
    return [y[i : i + frame_length] for i in range(0, len(y) - frame_length + 1, frame_length)]


def compute_energy(frame: np.ndarray) -> float:
    if frame.size == 0:
        return 0.0
    rms = np.sqrt(np.mean(frame**2))
    return float(np.clip(rms * 10, 0.0, 1.0))


def extract_mel_spectrogram(y: np.ndarray, sr: int) -> np.ndarray:
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
    mel_db = librosa.power_to_db(mel, ref=np.max)
    return (mel_db + 80) / 80
