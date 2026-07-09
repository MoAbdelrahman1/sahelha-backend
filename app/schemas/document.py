from __future__ import annotations

from typing import Any

from pydantic import BaseModel


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


class DocumentResponse(BaseModel):
    id: int
    original_name: str | None
    mime_type: str | None
    document_type: str
    status: str
    summary_arabic: str
    raw_text: str | None
    created_at: str
    service_name_ar: str | None
    owner_id: int | None
    tags: list[str] = []


class DocumentListResponse(BaseModel):
    documents: list[dict[str, Any]]
    total: int
    page: int


class ExtractedField(BaseModel):
    field_key: str
    field_label_ar: str
    field_value: str


class DocumentUploadRequest(BaseModel):
    service_id: int
    user_id: int | None
    fields: list[dict[str, str]] = []
