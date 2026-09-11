from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import ai_assistant, archive, auth, documents, legacy, reminders, voice
from app.db import SCHEMA_SQL, init_db
from app.services.scheduler import start_reminder_scheduler

app = FastAPI(title="Sahelha Backend", version="0.1.0")

_origins_env = os.getenv("ALLOWED_ORIGINS")
if _origins_env:
    _allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.on_event("startup")
def startup_event() -> None:
    os.makedirs("uploads", exist_ok=True)
    init_db(SCHEMA_SQL)
    start_reminder_scheduler()
    print("[VOICE SERVICE] ✅ Voice service is ready (STT: Groq Whisper-Large-v3, TTS: Edge-TTS ar-EG-SalmaNeural)")


from pathlib import Path
_uploads_dir = Path(__file__).parent.parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

app.include_router(legacy.router)
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(archive.router, prefix="/api/archive", tags=["Archive"])
app.include_router(reminders.router, prefix="/api/reminders", tags=["Reminders"])
app.include_router(ai_assistant.router, prefix="/api/ai", tags=["AI Assistant"])
