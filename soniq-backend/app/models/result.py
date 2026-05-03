from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AnalysisResult(Base):
    __tablename__ = "results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    job_id: Mapped[str] = mapped_column(String, ForeignKey("jobs.id"), unique=True, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)
    genre: Mapped[str] = mapped_column(String, nullable=False)
    bpm: Mapped[float] = mapped_column(Float, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)
    energy: Mapped[float] = mapped_column(Float, nullable=False)
    frames_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
