from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    spotify_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    display_name: Mapped[str] = mapped_column(String, default="Anonymous", nullable=False)
    email: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    spotify_access_token: Mapped[str | None] = mapped_column(String, nullable=True)
    spotify_refresh_token: Mapped[str | None] = mapped_column(String, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
