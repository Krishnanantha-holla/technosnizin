from pydantic import BaseModel


class AnalyzeResponse(BaseModel):
    job_id: str


class JobProgressResponse(BaseModel):
    type: str
    percent: int
    stage: str


class MetadataResponse(BaseModel):
    genre: str
    bpm: float
    key: str
    energy: float


class SpotifyCallbackRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
