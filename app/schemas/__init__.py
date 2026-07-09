from __future__ import annotations

from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.schemas.document import (
    DocumentAnalyzeResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUploadRequest,
    DocumentUploadResponse,
    ExtractedField,
    ReadDocumentResponse,
    UserDocumentResponse,
)
from app.schemas.service import NearbyOffice, ServiceCategory
from app.schemas.user import ChatMessageRequest, ChatMessageResponse, ChatSessionResponse, MessageResponse

__all__ = [
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "UserResponse",
    "DocumentAnalyzeResponse",
    "DocumentListResponse",
    "DocumentResponse",
    "DocumentUploadRequest",
    "DocumentUploadResponse",
    "ExtractedField",
    "ReadDocumentResponse",
    "UserDocumentResponse",
    "NearbyOffice",
    "ServiceCategory",
    "ChatMessageRequest",
    "ChatMessageResponse",
    "ChatSessionResponse",
    "MessageResponse",
]
