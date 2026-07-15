"""
app/api/ai.py
~~~~~~~~~~~~~
AI assistant voice Q&A endpoint.

POST /api/ai/ask
- Accepts a question + optional doc_id (for document context) + optional session_id
- Maintains per-session conversation memory in the chat_messages table
- Returns the LLM answer as text AND as a TTS audio URL
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user, get_upload_dir
from app.db import db_connection
from app.schemas.ai import AskRequest, AskResponse
from app.services.ai_chat_service import (
    ask_ai,
    fetch_history,
    get_or_create_session,
    store_message,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_doc_text(doc_id: int, user_id: int) -> str:
    """Return the raw OCR text for *doc_id* owned by *user_id*.

    Returns an empty string if the document doesn't exist or has no OCR text yet.
    """
    with db_connection() as conn:
        row = conn.execute(
            "SELECT raw_text FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return row["raw_text"] or ""


def _fetch_doc_summary_audio(doc_id: int, user_id: int) -> str | None:
    with db_connection() as conn:
        row = conn.execute(
            "SELECT ai_summary, voice_summary_url FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    summary = (row["ai_summary"] or "").strip()
    if not summary:
        return None

    voice_summary_url = (row["voice_summary_url"] or "").strip() if "voice_summary_url" in row.keys() else ""
    if voice_summary_url:
        return voice_summary_url

    generated_audio_url = _synthesize_tts(summary, user_id)
    if generated_audio_url:
        with db_connection() as conn:
            conn.execute(
                "UPDATE documents SET voice_summary_url = ? WHERE id = ? AND user_id = ?",
                (generated_audio_url, doc_id, user_id),
            )
            conn.commit()
    return generated_audio_url or None


def _sanitize_session_id(session_id: str | None) -> str | None:
    if session_id is None:
        return None
    cleaned = session_id.strip()
    if not cleaned or cleaned.lower() == "string":
        return None
    return cleaned


def _synthesize_tts(text: str, user_id: int) -> str:
    """Run TTS on *text* and return the public URL of the audio file.

    Falls back to an empty string if the voice_service is unavailable.
    """
    try:
        from app.services.voice_service import synthesize  # lazy import
    except Exception:
        return ""

    if not text.strip():
        return ""

    relative_name = f"{user_id}/ai_{uuid4().hex}.mp3"
    output_path = Path(get_upload_dir()) / relative_name
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        synthesize(text, "ar", str(output_path))
        return f"/uploads/{relative_name}"
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/ask", response_model=AskResponse)
def ai_ask(
    body: AskRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Answer a question about a document using Groq LLM + conversation memory.

    Request body
    ------------
    - ``question`` (str, required): The user's question in Arabic or English.
    - ``doc_id`` (int, optional): ID of a document to use as context.
      If omitted the assistant answers from conversation history alone.
    - ``session_id`` (str, optional): Existing chat session UUID.
      A new session is created when absent.

    Response
    --------
    - ``session_id``: The (possibly newly created) session UUID.
    - ``answer``: The LLM's answer text.
    - ``audio_url``: Public URL of the TTS MP3 (empty string if TTS failed).
    """
    user_id: int = current_user["id"]
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    session_id_input = _sanitize_session_id(body.session_id)

    # ── 1. Resolve / create session ──────────────────────────────────────────
    session_id = get_or_create_session(user_id, session_id_input)

    # ── 2. Fetch document context (if a doc_id was supplied) ─────────────────
    doc_text = ""
    doc_summary_audio_url: str | None = None
    if body.doc_id is not None:
        doc_text = _fetch_doc_text(body.doc_id, user_id)
        doc_summary_audio_url = _fetch_doc_summary_audio(body.doc_id, user_id)

    doc_text = doc_text.strip()

    if body.doc_id is not None and len(doc_text) < 20:
        answer = (
            "نص الوثيقة المستخرج قصير جدًا ولا يكفي للإجابة بدقة. "
            "من فضلك أعد رفع صورة أوضح أو اسأل سؤالًا عامًا بدون الاعتماد على هذه الوثيقة."
        )
        audio_url = _synthesize_tts(answer, user_id)
        store_message(session_id, "user", body.question)
        store_message(session_id, "assistant", answer, audio_url=audio_url or None)
        return {
            "session_id": session_id,
            "answer": answer,
            "audio_url": audio_url,
            "doc_summary_audio_url": doc_summary_audio_url,
        }

    # ── 3. Load conversation history ─────────────────────────────────────────
    history = fetch_history(session_id, limit=10)

    # ── 4. Persist the user's message ────────────────────────────────────────
    store_message(session_id, "user", body.question)

    # ── 5. Call LLM ──────────────────────────────────────────────────────────
    try:
        answer = ask_ai(doc_text, history, body.question)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    # ── 6. Synthesize TTS ────────────────────────────────────────────────────
    audio_url = _synthesize_tts(answer, user_id)

    # ── 7. Persist the assistant's reply ─────────────────────────────────────
    store_message(session_id, "assistant", answer, audio_url=audio_url or None)

    return {
        "session_id": session_id,
        "answer": answer,
        "audio_url": audio_url,
        "doc_summary_audio_url": doc_summary_audio_url,
    }


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return the full message history for a chat session."""
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, role, content, audio_url, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            """,
            (session_id,),
        ).fetchall()
    return [dict(row) for row in rows]
