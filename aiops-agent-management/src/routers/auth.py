import base64
import hashlib
import hmac
import json
import os
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["auth"])

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "agent-management-kit-dev-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = 60


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _create_jwt(payload: dict[str, Any]) -> str:
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    encoded_header = _base64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _base64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = hmac.new(
        JWT_SECRET_KEY.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{encoded_header}.{encoded_payload}.{_base64url_encode(signature)}"


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest):
    if credentials.username != "admin" or credentials.password != "admin":
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )

    now = datetime.now(UTC)
    token = _create_jwt(
        {
            "sub": credentials.username,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=JWT_EXPIRES_MINUTES)).timestamp()),
        }
    )
    return LoginResponse(access_token=token)
