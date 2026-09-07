from __future__ import annotations

import base64
import io
import json
import re
import sqlite3

import qrcode

from app.db import db_connection

SHARE_BASE_URL = "https://sahelha.app/view"

_FTS_TERM_RE = re.compile(r"[\w؀-ۿ]+", re.UNICODE)


def _build_fts_match(query: str) -> str | None:
    """Turn free-text input into a safe FTS5 MATCH expression: each token
    becomes a quoted prefix match, OR'd together for recall across an
    arbitrary user query (mirrors the old LIKE-anywhere behavior)."""
    terms = _FTS_TERM_RE.findall(query)
    if not terms:
        return None
    return " OR ".join(f'"{term}"*' for term in terms)


def _document_has_all_tags(row: sqlite3.Row, required_tags: list[str]) -> bool:
    try:
        doc_tags = {str(tag).casefold() for tag in json.loads(row["tags"] or "[]")}
    except (json.JSONDecodeError, TypeError):
        doc_tags = set()
    return all(tag.casefold() in doc_tags for tag in required_tags)


def search_documents(user_id: int, query: str, tags: list[str] | None = None) -> list[sqlite3.Row]:
    match_expr = _build_fts_match(query)
    required_tags = [t.strip() for t in (tags or []) if t.strip()]

    if match_expr is None:
        return []

    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT d.* FROM documents d
            JOIN documents_fts fts ON fts.rowid = d.id
            WHERE d.user_id = ? AND documents_fts MATCH ?
            ORDER BY rank
            LIMIT 50
            """,
            (user_id, match_expr),
        ).fetchall()

    # Tag filtering happens in Python, not SQL: tags are stored as a JSON
    # array (json.dumps default ensure_ascii=True escapes non-ASCII text),
    # so a raw SQL LIKE substring match would silently never match Arabic
    # tags. Comparing after json.loads works regardless of how the JSON was
    # encoded on disk.
    if required_tags:
        rows = [row for row in rows if _document_has_all_tags(row, required_tags)]

    return rows[:20]


def build_share_url(doc_id: int) -> str:
    return f"{SHARE_BASE_URL}/{doc_id}"


def generate_qr_base64(share_url: str) -> str:
    qr = qrcode.make(share_url)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")
