import json
import threading
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from src.database.database import get_session
from src.database.models import VertexConfig
from src.utils.secrets import decrypt_secret, encrypt_secret

_token_cache: Any = None
_token_cache_lock = threading.Lock()
_TOKEN_EXPIRY_BUFFER_SECONDS = 300

router = APIRouter(prefix="/vertex/config", tags=["vertex"])


class VertexConfigUpsert(BaseModel):
    project_id: str
    location: str
    staging_bucket: str
    google_application_credentials: dict[str, Any] | None = None


class VertexConfigRead(BaseModel):
    id: int
    project_id: str
    location: str
    staging_bucket: str
    has_google_application_credentials: bool
    created_at: datetime
    updated_at: datetime


class VertexTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_at: datetime


def _cached_token_valid() -> bool:
    if _token_cache is None or not _token_cache.token:
        return False
    if _token_cache.expiry is None:
        return False
    now = datetime.utcnow()
    return (_token_cache.expiry - now).total_seconds() > _TOKEN_EXPIRY_BUFFER_SECONDS


def _invalidate_token_cache() -> None:
    global _token_cache
    with _token_cache_lock:
        _token_cache = None


def _validate_payload(payload: VertexConfigUpsert) -> None:
    if not payload.project_id.strip():
        raise HTTPException(status_code=400, detail="project_id cannot be empty")
    if not payload.location.strip():
        raise HTTPException(status_code=400, detail="location cannot be empty")
    if not payload.staging_bucket.strip():
        raise HTTPException(status_code=400, detail="staging_bucket cannot be empty")


@router.get("/", response_model=VertexConfigRead)
def get_vertex_config(session: Session = Depends(get_session)):
    config = session.get(VertexConfig, 1)
    if config is None:
        raise HTTPException(status_code=404, detail="Vertex config not found")
    return VertexConfigRead(
        id=config.id,
        project_id=config.project_id,
        location=config.location,
        staging_bucket=config.staging_bucket,
        has_google_application_credentials=bool(config.service_account_json),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.post("/", response_model=VertexConfigRead)
def upsert_vertex_config(
    payload: VertexConfigUpsert,
    session: Session = Depends(get_session),
):
    _invalidate_token_cache()
    _validate_payload(payload)
    config = session.get(VertexConfig, 1)
    encrypted_json = (
        encrypt_secret(json.dumps(payload.google_application_credentials))
        if payload.google_application_credentials
        else None
    )
    if config is None:
        config = VertexConfig(
            id=1,
            project_id=payload.project_id,
            location=payload.location,
            staging_bucket=payload.staging_bucket,
            service_account_json=encrypted_json,
        )
    else:
        config.project_id = payload.project_id
        config.location = payload.location
        config.staging_bucket = payload.staging_bucket
        config.service_account_json = encrypted_json
        config.updated_at = datetime.now()

    session.add(config)
    session.commit()
    session.refresh(config)
    return VertexConfigRead(
        id=config.id,
        project_id=config.project_id,
        location=config.location,
        staging_bucket=config.staging_bucket,
        has_google_application_credentials=bool(config.service_account_json),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.delete("/")
def delete_vertex_config(session: Session = Depends(get_session)):
    _invalidate_token_cache()
    config = session.get(VertexConfig, 1)
    if config is None:
        raise HTTPException(status_code=404, detail="Vertex config not found")
    session.delete(config)
    session.commit()
    return {"ok": True}


@router.get("/token", response_model=VertexTokenResponse)
def get_vertex_token(session: Session = Depends(get_session)):
    global _token_cache
    import google.auth
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2 import service_account

    with _token_cache_lock:
        if _cached_token_valid():
            return VertexTokenResponse(
                access_token=_token_cache.token,
                expires_at=_token_cache.expiry,
            )

        config = session.get(VertexConfig, 1)
        scopes = ["https://www.googleapis.com/auth/cloud-platform"]

        try:
            if config and config.service_account_json:
                sa_info = json.loads(decrypt_secret(config.service_account_json))
                credentials = service_account.Credentials.from_service_account_info(
                    sa_info, scopes=scopes
                )
            else:
                credentials, _ = google.auth.default(scopes=scopes)

            credentials.refresh(GoogleAuthRequest())
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to generate token: {exc}"
            ) from exc

        _token_cache = credentials

    return VertexTokenResponse(
        access_token=_token_cache.token,
        expires_at=_token_cache.expiry,
    )
