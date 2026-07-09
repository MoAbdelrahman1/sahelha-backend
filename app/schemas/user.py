from __future__ import annotations

from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    session_id: str | None = None
    message: str


class ChatMessageResponse(BaseModel):
    session_id: str
    response_text: str
    response_audio_url: str
    action_cards: list[dict[str, str]] = []


class ChatSessionResponse(BaseModel):
    session_id: str
    created_at: str
    last_message_at: str
    messages: list[dict[str, Any]] = []


class MessageResponse(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    audio_url: str | None
    created_at: str
