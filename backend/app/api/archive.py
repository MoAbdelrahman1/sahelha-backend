from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.api.documents import _row_to_document
from app.core.security import get_current_user
from app.db import db_connection
from app.schemas import UserDocumentResponse
from app.services.archive_service import (
    generate_qr_base64,
    get_or_create_share_token,
    render_document_pdf,
    search_documents,
)

router = APIRouter()


@router.get("/search", response_model=list[UserDocumentResponse])
def search(
    q: str = Query(..., min_length=1, description="Natural language query"),
    tags: str | None = Query(default=None, description="Comma-separated tags, all must match"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    tag_list = tags.split(",") if tags else []
    rows = search_documents(current_user["id"], q, tag_list)
    return [_row_to_document(row) for row in rows]


@router.get("/share/{doc_id}")
def share_document(
    doc_id: int, request: Request, current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, str]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT id FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, current_user["id"]),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    token = get_or_create_share_token(doc_id)
    # Built from the incoming request's own host, not a hardcoded domain, so
    # the link/QR actually resolves to this backend (LAN address, tunnel,
    # whatever the caller is really reaching us on) instead of a placeholder
    # that serves nothing.
    share_url = f"{str(request.base_url).rstrip('/')}/api/archive/view/{token}"
    return {"qr_image_base64": generate_qr_base64(share_url), "share_url": share_url}


@router.get("/view/{token}")
def view_shared_document(token: str) -> Response:
    """Public, unauthenticated: this is the actual QR/link target, opened by
    whoever the document owner shared it with, not by the app itself. Serves
    the document re-rendered as a real PDF instead of a page that doesn't
    exist, so scanning the QR downloads something usable."""
    with db_connection() as connection:
        row = connection.execute("SELECT * FROM documents WHERE share_token = ?", (token,)).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Shared document not found")

    pdf_bytes = render_document_pdf(row)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="document-{row["id"]}.pdf"'},
    )
