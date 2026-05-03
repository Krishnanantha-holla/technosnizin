from pydantic import BaseModel, Field


class InstrumentFrame(BaseModel):
    timestamp: float = Field(..., ge=0)
    bass: float = Field(..., ge=0, le=1)
    drums: float = Field(..., ge=0, le=1)
    guitar: float = Field(..., ge=0, le=1)
    keys: float = Field(..., ge=0, le=1)
    vocals: float = Field(..., ge=0, le=1)
    other: float = Field(..., ge=0, le=1)


class AnalysisResultOut(BaseModel):
    duration: float
    genre: str
    bpm: float
    key: str
    energy: float
    frames: list[InstrumentFrame]
