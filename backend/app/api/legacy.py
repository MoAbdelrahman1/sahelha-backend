from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.db import db_connection
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

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/ready")
def readiness_check() -> dict[str, Any]:
    try:
        with db_connection() as connection:
            connection.execute("SELECT 1")
        return {"status": "ready", "database": "ok"}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=503, detail={"status": "not_ready", "database": str(exc)}) from exc


@router.get("/api/services", response_model=list[ServiceCategory])
def list_services() -> list[dict[str, Any]]:
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT id, name_ar, icon_emoji, icon_url FROM service_categories ORDER BY id"
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@router.get("/api/services/{service_id}/steps", response_model=dict[str, Any])
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


@router.get("/api/offices/nearby", response_model=list[NearbyOffice])
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


@router.post("/api/document/analyze", response_model=DocumentAnalyzeResponse)

async def analyze_document(
    text: str | None = Form(default=None),
    session_id: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    import tempfile, os
    from app.services.pipeline import process_document_pipeline

    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Save uploaded file to a temp path so pipeline can read it
    suffix = os.path.splitext(file.filename or "")[-1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = process_document_pipeline(tmp_path)
    finally:
        os.unlink(tmp_path)

    doc_type = result.get("doc_type", "unknown")
    summary = result.get("summary", "")
    entities = result.get("entities", {})

    # Convert entities dict to fields list that frontend expects
    fields = [
        {"field_key": k, "field_label_ar": k, "field_value": v}
        for k, v in entities.items() if v
    ]

    document_id = store_document(
        session_id,
        file.filename,
        file.content_type,
        doc_type,
        summary,
        result.get("ocr_text", ""),
        fields,
    )

    return {
        "document_type": doc_type,
        "summary_arabic": summary,
        "fields": fields,
        "next_steps": suggested_next_steps(doc_type),
        "document_id": document_id,
    }

@router.post("/api/document/read", response_model=ReadDocumentResponse)
def read_document(text: str = Form(...), language: str = Form(default="ar")) -> dict[str, Any]:
    cache_key = get_or_create_audio_asset(text=text, language=language)
    return {"text": text, "audio_url": f"/api/audio/{cache_key}", "cached": True}


@router.get("/api/audio/{cache_key}")
def get_audio(cache_key: str) -> Response:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT content_type, audio_blob FROM audio_assets WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Audio not found")

    return Response(content=row["audio_blob"], media_type=row["content_type"])


@router.post("/api/chat/message", response_model=ChatMessageResponse)
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
