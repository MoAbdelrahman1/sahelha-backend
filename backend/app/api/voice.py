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
async def text_to_speech(
    body: VoiceSynthesizeRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Thin HTTP wrapper around app.services.voice_service.synthesize(text,
    language, output_path) -> None, writing under uploads/ so the existing
    StaticFiles mount at /uploads can serve the result."""
    print(f"[VOICE TTS] Received request - text length: {len(body.text) if body.text else 0}, language: {body.language!r}")
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    try:
        from app.services.voice_service import synthesize
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    relative_name = f"{current_user['id']}/tts_{uuid4().hex}.mp3"
    output_path = Path(get_upload_dir()) / relative_name
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        synthesize(body.text, body.language or "ar", str(output_path))
    except Exception as e:
        print(f"[VOICE TTS] synthesize() failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {e}")

    return {"audio_url": f"/{output_path.as_posix()}"}
