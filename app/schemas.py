from __future__ import annotations

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    session_id: str | None = None
    message: str = Field(min_length=1)


class ChatMessageResponse(BaseModel):
    session_id: str
    response_text: str
    response_audio_url: str
    action_cards: list[dict[str, str]] = []


class DocumentAnalyzeResponse(BaseModel):
    document_type: str
    summary_arabic: str
    fields: list[dict[str, str]]
    next_steps: list[str]
    document_id: int


class ReadDocumentResponse(BaseModel):
    text: str
    audio_url: str
    cached: bool


class ServiceCategory(BaseModel):
    id: int
    name_ar: str
    icon_emoji: str
    icon_url: str | None = None


class NearbyOffice(BaseModel):
    id: int
    name_ar: str
    address_ar: str
    coords: dict[str, float]
    hours: str
    phone: str
    distance_km: float
