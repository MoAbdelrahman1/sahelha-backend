from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, List, Dict

from app.db import db_connection
from app.services.ai_service import _get_client, _GROQ_MODEL, SYSTEM_PROMPT

# ---------------------------------------------------------------------------
# Session handling
# ---------------------------------------------------------------------------

def get_or_create_session(user_id: int, document_id: int, session_id: str | None = None) -> str:
    """Return an existing session ID (scoped to this user + document) or create a new one."""
    with db_connection() as conn:
        if session_id:
            row = conn.execute(
                "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND document_id = ?",
                (session_id, user_id, document_id),
            ).fetchone()
            if row:
                return session_id
            # Unknown or foreign session id: fall through and mint a fresh one
            # rather than trusting a caller-supplied id for a different user/document.

        new_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO chat_sessions (id, created_at, last_message_at, user_id, document_id) VALUES (?, ?, ?, ?, ?)",
            (new_id, now, now, user_id, document_id),
        )
        conn.commit()
        return new_id


# ---------------------------------------------------------------------------
# Message persistence
# ---------------------------------------------------------------------------

def store_message(
    session_id: str,
    role: str,
    content: str,
    audio_url: str | None = None,
) -> int:
    """Insert a chat message, update session timestamp, and return the message ID."""
    with db_connection() as conn:
        now = datetime.utcnow().isoformat()
        cur = conn.execute(
            """
            INSERT INTO chat_messages (session_id, role, content, audio_url, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, role, content, audio_url, now),
        )
        conn.execute(
            "UPDATE chat_sessions SET last_message_at = ? WHERE id = ?",
            (now, session_id)
        )
        conn.commit()
        return cur.lastrowid


# ---------------------------------------------------------------------------
# History retrieval (last N messages, oldest first)
# ---------------------------------------------------------------------------

def fetch_history(session_id: str, limit: int = 10) -> List[Dict[str, str]]:
    """Return the most recent *limit* messages ordered chronologically."""
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT role, content FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
        return [{"role": row["role"], "content": row["content"]} for row in rows]


# ---------------------------------------------------------------------------
# LLM invocation for Q&A
# ---------------------------------------------------------------------------

def ask_ai(document_text: str, history: List[Dict[str, str]], question: str) -> str:
    """Call Groq to answer *question* using *document_text* as context."""
    client = _get_client()
    system_prompt = (
        SYSTEM_PROMPT
        + "\n\nYou have the following OCR-extracted Arabic document text as context:\n"
        + document_text
    )
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": question})

    completion = client.chat.completions.create(
        model=_GROQ_MODEL,
        temperature=0.1,
        max_tokens=1024,
        messages=messages,
    )
    answer = completion.choices[0].message.content or ""
    return answer.strip()


__all__ = [
    "get_or_create_session",
    "store_message",
    "fetch_history",
    "ask_ai",
]