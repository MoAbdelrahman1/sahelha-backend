from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.documents import _row_to_document
from app.core.security import get_current_user
from app.db import db_connection
from app.schemas import UserDocumentResponse
from app.services.archive_service import build_share_url, generate_qr_base64, search_documents

router = APIRouter()


@router.get("/search", response_model=list[UserDocumentResponse])
def search(
    q: str = Query(..., min_length=1, description="Natural language query"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = search_documents(current_user["id"], q)
    return [_row_to_document(row) for row in rows]


@router.get("/share/{doc_id}")
def share_document(doc_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT id FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, current_user["id"]),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    share_url = build_share_url(doc_id)
    return {"qr_image_base64": generate_qr_base64(share_url), "share_url": share_url}
