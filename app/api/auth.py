from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import create_access_token, create_refresh_token, get_current_user, hash_password, now_iso, verify_password
from app.db import db_connection
from app.schemas import FcmTokenRequest, LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter()


def _issue_tokens(user_row: dict[str, Any]) -> dict[str, Any]:
    return {
        "access_token": create_access_token(user_row["id"]),
        "refresh_token": create_refresh_token(user_row["id"]),
        "token_type": "bearer",
        "user": UserResponse(**user_row),
    }


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest) -> dict[str, Any]:
    with db_connection() as connection:
        existing = connection.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
        if existing is not None:
            raise HTTPException(status_code=400, detail="Email already registered")

        password_hash, password_salt = hash_password(body.password)
        cursor = connection.execute(
            """
            INSERT INTO users (email, password_hash, password_salt, full_name, phone, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (body.email, password_hash, password_salt, body.full_name, body.phone, now_iso()),
        )
        connection.commit()

        user_row = connection.execute(
            "SELECT id, email, full_name, phone, created_at FROM users WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return _issue_tokens(dict(user_row))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> dict[str, Any]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT id, email, password_hash, password_salt, full_name, phone, created_at FROM users WHERE email = ?",
            (body.email.strip().lower(),),
        ).fetchone()

    if row is None or not verify_password(body.password, row["password_hash"], row["password_salt"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_row = {key: row[key] for key in ("id", "email", "full_name", "phone", "created_at")}
    return _issue_tokens(user_row)


@router.get("/me", response_model=UserResponse)
def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return current_user


@router.put("/fcm-token")
def update_fcm_token(
    body: FcmTokenRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, str]:
    with db_connection() as connection:
        connection.execute(
            "UPDATE users SET fcm_token = ? WHERE id = ?",
            (body.fcm_token, current_user["id"]),
        )
        connection.commit()
    return {"message": "FCM token updated"}
