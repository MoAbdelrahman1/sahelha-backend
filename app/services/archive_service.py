from __future__ import annotations

import base64
import io
import sqlite3

import qrcode

from app.db import db_connection

SHARE_BASE_URL = "https://sahelha.app/view"


def search_documents(user_id: int, query: str) -> list[sqlite3.Row]:
    like_term = f"%{query.strip()}%"
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM documents
            WHERE user_id = ?
              AND (
                    document_type LIKE ? COLLATE NOCASE
                 OR ai_summary LIKE ? COLLATE NOCASE
                 OR raw_text LIKE ? COLLATE NOCASE
                 OR tags LIKE ? COLLATE NOCASE
              )
            ORDER BY created_at DESC
            LIMIT 20
            """,
            (user_id, like_term, like_term, like_term, like_term),
        ).fetchall()
    return rows


def build_share_url(doc_id: int) -> str:
    return f"{SHARE_BASE_URL}/{doc_id}"


def generate_qr_base64(share_url: str) -> str:
    qr = qrcode.make(share_url)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")
