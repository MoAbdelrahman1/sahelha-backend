from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import archive, auth, documents, legacy, reminders, voice
from app.db import SCHEMA_SQL, init_db
from app.services.scheduler import start_reminder_scheduler

app = FastAPI(title="Sahelha Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
