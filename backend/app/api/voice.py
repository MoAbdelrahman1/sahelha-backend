from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.security import get_current_user, get_upload_dir
from app.core.storage import file_extension, save_upload_file
from app.schemas import VoiceSynthesizeRequest, VoiceSynthesizeResponse, VoiceTranscribeResponse

router = APIRouter()


@router.post("/stt", response_model=VoiceTranscribeResponse)
async def speech_to_text(
    file: UploadFile = File(...),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Thin HTTP wrapper: saves the upload, then calls the AI engineer's
    app.services.voice_service.transcribe(audio_path) -> str. That module
    doesn't exist yet, so this degrades to 503 until it's built (same pattern
    as app/api/documents.py did before app/services/pipeline.py existed)."""
    content = await file.read()
    ext = file_extension(file.filename or "") or ".wav"
    relative_name = f"{current_user['id']}/{uuid4().hex}{ext}"
    audio_path = save_upload_file(get_upload_dir(), relative_name, content)

    try:
        from app.services.voice_service import transcribe
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    transcript = transcribe(audio_path)
    return {"transcript": transcript, "language": "ar"}


@router.post("/tts", response_model=VoiceSynthesizeResponse)
def text_to_speech(
    body: VoiceSynthesizeRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Thin HTTP wrapper around app.services.voice_service.synthesize(text,
    language, output_path) -> None, writing under uploads/ so the existing
    StaticFiles mount at /uploads can serve the result."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    try:
        from app.services.voice_service import synthesize
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    relative_name = f"{current_user['id']}/tts_{uuid4().hex}.wav"
    output_path = Path(get_upload_dir()) / relative_name
    output_path.parent.mkdir(parents=True, exist_ok=True)
    synthesize(body.text, body.language, str(output_path))

    return {"audio_url": f"/{output_path.as_posix()}"}
