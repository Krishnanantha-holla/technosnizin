from datetime import UTC, datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.job import SpotifyCallbackRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def create_jwt(user_id: str) -> str:
    expires = datetime.now(tz=UTC) + timedelta(minutes=settings.JWT_EXP_MINUTES)
    payload = {"sub": user_id, "exp": expires}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.post("/spotify/callback", response_model=TokenResponse)
async def spotify_callback(payload: SpotifyCallbackRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET or not settings.SPOTIFY_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Spotify OAuth is not configured")

    token_url = "https://accounts.spotify.com/api/token"
    profile_url = "https://api.spotify.com/v1/me"

    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": payload.code,
                "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
                "client_id": settings.SPOTIFY_CLIENT_ID,
                "client_secret": settings.SPOTIFY_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spotify token exchange failed: {token_response.text}",
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = int(token_data.get("expires_in", 3600))

        if not access_token:
            raise HTTPException(status_code=400, detail="Spotify did not return an access token")

        profile_response = await client.get(profile_url, headers={"Authorization": f"Bearer {access_token}"})
        if profile_response.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Spotify profile fetch failed: {profile_response.text}")

        profile = profile_response.json()

    spotify_id = profile.get("id")
    if not spotify_id:
        raise HTTPException(status_code=400, detail="Spotify profile missing user id")

    email = profile.get("email")
    display_name = profile.get("display_name") or "Spotify User"
    expires_at = datetime.now(tz=UTC) + timedelta(seconds=expires_in)

    result = await db.execute(select(User).where(User.spotify_id == spotify_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            spotify_id=spotify_id,
            display_name=display_name,
            email=email,
            spotify_access_token=access_token,
            spotify_refresh_token=refresh_token,
            token_expires_at=expires_at,
        )
        db.add(user)
    else:
        user.display_name = display_name
        user.email = email
        user.spotify_access_token = access_token
        user.spotify_refresh_token = refresh_token
        user.token_expires_at = expires_at

    await db.commit()
    await db.refresh(user)

    jwt_token = create_jwt(user.id)
    return TokenResponse(access_token=jwt_token)
