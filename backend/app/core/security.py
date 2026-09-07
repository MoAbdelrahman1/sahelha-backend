from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import ACCESS_TOKEN_EXPIRE_HOURS, REFRESH_TOKEN_EXPIRE_DAYS, SECRET_KEY
from app.db import db_connection

bearer_scheme = HTTPBearer()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_hash(*parts: str) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode("utf-8"))
        digest.update(b"::")
    return digest.hexdigest()


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return hashed.hex(), salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    check, _ = hash_password(password, salt)
    return secrets.compare_digest(check, hashed)


def generate_api_key() -> str:
    return secrets.token_urlsafe(32)


def generate_session_token() -> str:
    return secrets.token_urlsafe(16)


def generate_refresh_token() -> str:
    return secrets.token_hex(32)


def get_groq_api_key() -> Optional[str]:
    return os.getenv("GROQ_API_KEY")


def get_upload_dir() -> str:
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


# --- JWT (HS256), stdlib-only -----------------------------------------
# python-jose / PyJWT aren't installed and this environment has no network
# access to add them. This hand-rolled encoder produces spec-compliant
# HS256 JWTs (header.payload.signature, base64url, HMAC-SHA256), so it's a
# drop-in swap for a real JWT library later if desired.

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _encode_jwt(payload: dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    segments = [
        _b64url_encode(json.dumps(header, separators=(",", ":")).encode()),
        _b64url_encode(json.dumps(payload, separators=(",", ":")).encode()),
    ]
    signing_input = ".".join(segments).encode()
    signature = hmac.new(SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
    segments.append(_b64url_encode(signature))
    return ".".join(segments)


def _decode_jwt(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise ValueError("Malformed token") from exc

    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_signature = hmac.new(SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(expected_signature, _b64url_decode(signature_b64)):
        raise ValueError("Invalid signature")

    payload = json.loads(_b64url_decode(payload_b64))
    if payload.get("exp") is not None and time.time() > float(payload["exp"]):
        raise ValueError("Token expired")
    return payload


def create_access_token(user_id: int) -> str:
    expire = time.time() + ACCESS_TOKEN_EXPIRE_HOURS * 3600
    return _encode_jwt({"sub": str(user_id), "exp": expire, "type": "access"})


def create_refresh_token(user_id: int) -> str:
    expire = time.time() + REFRESH_TOKEN_EXPIRE_DAYS * 86400
    return _encode_jwt({"sub": str(user_id), "exp": expire, "type": "refresh"})


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict[str, Any]:
    try:
        payload = _decode_jwt(credentials.credentials)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    with db_connection() as connection:
        row = connection.execute(
            "SELECT id, email, full_name, phone, fcm_token, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return dict(row)
