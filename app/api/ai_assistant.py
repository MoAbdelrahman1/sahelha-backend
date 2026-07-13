from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.security import get_current_user, get_upload_dir
from app.core.storage import file_extension, save_upload_file
from app.db import db_connection
from app.schemas import AiAskResponse
from app.services.ai_chat_service import ask_ai, fetch_history, get_or_create_session, store_message

router = APIRouter()


def _get_owned_document_text(doc_id: int, user_id: int) -> str:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT raw_text FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    document_text = row["raw_text"] or ""
    if not document_text.strip():
        raise HTTPException(status_code=400, detail="Document has no extracted text yet")
    return document_text


@router.post("/ask", response_model=AiAskResponse)
async def ask(
    document_id: int = Form(...),
    session_id: str | None = Form(default=None),
    question: str | None = Form(default=None),
    audio: UploadFile | None = File(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Voice/text Q&A over a specific document: OCR text as context, Groq for
    the answer, conversation history persisted per session, answer returned
    as both text and synthesized speech."""
    document_text = _get_owned_document_text(document_id, current_user["id"])

    if audio is not None:
        content = await audio.read()
        ext = file_extension(audio.filename or "") or ".wav"
        relative_name = f"{current_user['id']}/{uuid4().hex}{ext}"
        audio_path = save_upload_file(get_upload_dir(), relative_name, content)

        from app.services.voice_service import transcribe

        question = transcribe(audio_path)

    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="Provide either 'question' text or an 'audio' file")

    resolved_session_id = get_or_create_session(current_user["id"], document_id, session_id)
    history = fetch_history(resolved_session_id)

    answer = ask_ai(document_text, history, question)

    store_message(resolved_session_id, "user", question)

    from app.services.voice_service import synthesize

    relative_name = f"{current_user['id']}/ai_{uuid4().hex}.mp3"
    output_path = Path(get_upload_dir()) / relative_name
    output_path.parent.mkdir(parents=True, exist_ok=True)
    synthesize(answer, "ar", str(output_path))
    answer_audio_url = f"/{output_path.as_posix()}"

    store_message(resolved_session_id, "assistant", answer, audio_url=answer_audio_url)

    return {
        "session_id": resolved_session_id,
        "question": question,
        "answer": answer,
        "answer_audio_url": answer_audio_url,
    }
