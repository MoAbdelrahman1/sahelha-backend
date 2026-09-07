from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ReminderCreate(BaseModel):
    document_id: int | None = None
    remind_at: datetime
    message: str | None = None


class ReminderResponse(BaseModel):
    id: int
    document_id: int | None
    remind_at: str
    message: str | None
    sent: bool
    created_at: str


class FcmTokenRequest(BaseModel):
    fcm_token: str
