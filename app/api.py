from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.db import db_connection, init_db
from app.schemas import ChatMessageRequest, ChatMessageResponse, DocumentAnalyzeResponse, NearbyOffice, ReadDocumentResponse, ServiceCategory
from app.services import (
    extract_document_fields,
    generate_arabic_reply,
    get_or_create_audio_asset,
    get_or_create_session,
    haversine_km,
    infer_document_type,
    row_to_dict,
    store_chat_message,
    store_document,
    suggested_next_steps,
    summarize_document,
)


app = FastAPI(title="Sahelha Backend", version="0.1.0")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_message_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    audio_url TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    original_name TEXT,
    mime_type TEXT,
    document_type TEXT NOT NULL,
    summary_arabic TEXT NOT NULL,
    raw_text TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    field_key TEXT NOT NULL,
    field_label_ar TEXT NOT NULL,
    field_value TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audio_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    text_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    language TEXT NOT NULL,
    content_type TEXT NOT NULL,
    audio_blob BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY,
    name_ar TEXT NOT NULL,
    icon_emoji TEXT NOT NULL,
    icon_url TEXT
);

CREATE TABLE IF NOT EXISTS service_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    item_order INTEGER NOT NULL,
    document_text_ar TEXT NOT NULL,
    FOREIGN KEY (service_id) REFERENCES service_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    icon TEXT NOT NULL,
    text_ar TEXT NOT NULL,
    audio_url TEXT,
    FOREIGN KEY (service_id) REFERENCES service_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY,
    name_ar TEXT NOT NULL,
    address_ar TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    hours TEXT NOT NULL,
    phone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS office_services (
    office_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    PRIMARY KEY (office_id, service_id),
    FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES service_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_request_cache (
    cache_key TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


@app.on_event("startup")
def startup_event() -> None:
    init_db(SCHEMA_SQL)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/ready")
def readiness_check() -> dict[str, Any]:
    try:
        with db_connection() as connection:
            connection.execute("SELECT 1")
        return {"status": "ready", "database": "ok"}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=503, detail={"status": "not_ready", "database": str(exc)}) from exc


@app.get("/api/services", response_model=list[ServiceCategory])
def list_services() -> list[dict[str, Any]]:
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT id, name_ar, icon_emoji, icon_url FROM service_categories ORDER BY id"
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.get("/api/services/{service_id}/steps", response_model=dict[str, Any])
def get_service_steps(service_id: int) -> dict[str, Any]:
    with db_connection() as connection:
        service_row = connection.execute(
            "SELECT id, name_ar, icon_emoji, icon_url FROM service_categories WHERE id = ?",
            (service_id,),
        ).fetchone()
        if service_row is None:
            raise HTTPException(status_code=404, detail="Service not found")

        steps = connection.execute(
            """
            SELECT step_order, icon, text_ar, audio_url
            FROM service_steps
            WHERE service_id = ?
            ORDER BY step_order
            """,
            (service_id,),
        ).fetchall()

        requirements = connection.execute(
            """
            SELECT document_text_ar
            FROM service_requirements
            WHERE service_id = ?
            ORDER BY item_order
            """,
            (service_id,),
        ).fetchall()

    return {
        "service": row_to_dict(service_row),
        "steps": [row_to_dict(step) for step in steps],
        "required_documents": [row["document_text_ar"] for row in requirements],
        "estimated_time": "10-15 minutes",
        "fees": "حسب الخدمة",
    }


@app.get("/api/offices/nearby", response_model=list[NearbyOffice])
def nearby_offices(lat: float, lng: float, service_id: int | None = None) -> list[dict[str, Any]]:
    with db_connection() as connection:
        if service_id is None:
            rows = connection.execute(
                "SELECT id, name_ar, address_ar, lat, lng, hours, phone FROM offices"
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT o.id, o.name_ar, o.address_ar, o.lat, o.lng, o.hours, o.phone
                FROM offices o
                INNER JOIN office_services os ON os.office_id = o.id
                WHERE os.service_id = ?
                """,
                (service_id,),
            ).fetchall()

    offices = []
    for row in rows:
        office = row_to_dict(row)
        office["coords"] = {"lat": float(office.pop("lat")), "lng": float(office.pop("lng"))}
        office["distance_km"] = round(
            haversine_km(lat, lng, office["coords"]["lat"], office["coords"]["lng"]),
            2,
        )
        offices.append(office)

    offices.sort(key=lambda item: item["distance_km"])
    return offices


@app.post("/api/document/analyze", response_model=DocumentAnalyzeResponse)
async def analyze_document(
    text: str | None = Form(default=None),
    session_id: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    file_text = text or ""
    original_name = file.filename if file else None
    mime_type = file.content_type if file else None

    if file is not None:
        file_bytes = await file.read()
        if not file_text and file_bytes:
            try:
                file_text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                file_text = ""

    document_type = infer_document_type(file_text, original_name)
    summary_arabic = summarize_document(document_type, file_text)
    fields = extract_document_fields(file_text)
    document_id = store_document(session_id, original_name, mime_type, document_type, summary_arabic, file_text, fields)

    return {
        "document_type": document_type,
        "summary_arabic": summary_arabic,
        "fields": fields,
        "next_steps": suggested_next_steps(document_type),
        "document_id": document_id,
    }


@app.post("/api/document/read", response_model=ReadDocumentResponse)
def read_document(text: str = Form(...), language: str = Form(default="ar")) -> dict[str, Any]:
    cache_key = get_or_create_audio_asset(text=text, language=language)
    return {"text": text, "audio_url": f"/api/audio/{cache_key}", "cached": True}


@app.get("/api/audio/{cache_key}")
def get_audio(cache_key: str) -> Response:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT content_type, audio_blob FROM audio_assets WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Audio not found")

    return Response(content=row["audio_blob"], media_type=row["content_type"])


@app.post("/api/chat/message", response_model=ChatMessageResponse)
def chat_message(payload: ChatMessageRequest) -> dict[str, Any]:
    session_id = get_or_create_session(payload.session_id)
    store_chat_message(session_id, "user", payload.message)

    response_text, action_cards = generate_arabic_reply(payload.message)
    audio_key = get_or_create_audio_asset(response_text, language="ar")
    response_audio_url = f"/api/audio/{audio_key}"

    store_chat_message(session_id, "assistant", response_text, audio_url=response_audio_url)

    return {
        "session_id": session_id,
        "response_text": response_text,
        "response_audio_url": response_audio_url,
        "action_cards": action_cards,
    }


@app.post("/api/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...), language: str = Form(default="ar")) -> dict[str, Any]:
    file_bytes = await file.read()
    transcript = (
        "هذه نسخة أولية. تم استلام الملف بنجاح، لكن ربط Whisper لم يُفعّل بعد. "
        f"اسم الملف: {file.filename}. الحجم: {len(file_bytes)} بايت."
    )

    return {"language": language, "transcript": transcript, "provider": "placeholder", "ready_for_chat": True}