from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import ai_assistant, archive, auth, documents, legacy, reminders, voice
from app.db import SCHEMA_SQL, init_db
from app.services.scheduler import start_reminder_scheduler

app = FastAPI(title="Sahelha Backend", version="0.1.0")

# Comma-separated list of allowed frontend origins, e.g.
# "https://sahelha.app,https://staging.sahelha.app". Defaults to local dev
# origins only — set ALLOWED_ORIGINS in production, "*" is not permitted
# together with credentials and shouldn't be used past local development.
_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8081").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    os.makedirs("uploads", exist_ok=True)
    init_db(SCHEMA_SQL)
    start_reminder_scheduler()


app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(legacy.router)
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(archive.router, prefix="/api/archive", tags=["Archive"])
app.include_router(reminders.router, prefix="/api/reminders", tags=["Reminders"])
app.include_router(ai_assistant.router, prefix="/api/ai", tags=["AI Assistant"])
