from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timezone
from typing import Optional


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
