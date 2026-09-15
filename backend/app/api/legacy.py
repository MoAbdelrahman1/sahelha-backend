from __future__ import annotations

import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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


from app.api.documents import get_optional_current_user

@router.post("/api/document/analyze", response_model=DocumentAnalyzeResponse)
async def analyze_document(
    text: str | None = Form(default=None),
    session_id: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: dict[str, Any] | None = Depends(get_optional_current_user),
) -> dict[str, Any]:
    import asyncio
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
        result = await asyncio.to_thread(process_document_pipeline, tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


    from app.services.ai_service import _coerce_result

    coerced = _coerce_result(result, result.get("ocr_text", ""))

    doc_type = coerced.get("doc_type", "unknown")
    summary = coerced.get("summary", "")
    entities = coerced.get("entities", {})
    issuer = coerced.get("issuer", "")
    doc_number = coerced.get("doc_number", "")
    amount = coerced.get("amount", "")
    actions = coerced.get("actions", "")
    issue_date = coerced.get("issue_date")
    expiry_date = coerced.get("expiry_date")

    doc_type_labels = {
        "national_id": "بطاقة رقم قومي",
        "passport": "جواز سفر",
        "birth_certificate": "شهادة ميلاد",
        "utility_bill": "فاتورة خدمات (كهرباء / مياه / غاز)",
        "receipt": "إيصال سداد",
        "invoice": "فاتورة رسمية",
        "driving_license": "رخصة قيادة / تسيير",
        "marriage_certificate": "وثيقة زواج",
        "death_certificate": "شهادة وفاة",
        "property_record": "سجل عقاري / ملكية",
        "government_document": "مستند حكومي رسمي",
        "unknown": "مستند رسمي",
    }
    doc_type_ar = doc_type_labels.get(doc_type, doc_type)

    # Convert all extracted intelligence into fields matching frontend SCAN_ROW_KEY_MAP
    fields: list[dict[str, str]] = []

    # 1. Document Type
    fields.append({"field_key": "doc_type", "field_label_ar": "نوع المستند", "field_value": doc_type_ar})

    # 2. Issuer
    if issuer:
        fields.append({"field_key": "issuer", "field_label_ar": "الجهة الحكومية", "field_value": str(issuer)})

    # 3. Document Number
    if doc_type == "national_id":
        if doc_number and len(str(doc_number)) == 14 and str(doc_number).isdigit():
            fields.append({"field_key": "doc_number", "field_label_ar": "الرقم القومي", "field_value": str(doc_number)})
    elif doc_number:
        fields.append({"field_key": "doc_number", "field_label_ar": "رقم المستند", "field_value": str(doc_number)})

    # 4. Dates & Expiry
    dates_list = []
    clean_nid = re.sub(r"\D", "", str(doc_number or ""))
    derived_birthdate = None
    if len(clean_nid) == 14 and clean_nid[0] in ("2", "3"):
        century = 1900 if clean_nid[0] == "2" else 2000
        yr = century + int(clean_nid[1:3])
        mo = int(clean_nid[3:5])
        day = int(clean_nid[5:7])
        if 1 <= mo <= 12 and 1 <= day <= 31:
            derived_birthdate = f"{yr:04d}/{mo:02d}/{day:02d}"

    if derived_birthdate and doc_type in ("national_id", "birth_certificate"):
        dates_list.append(f"ميلاد: {derived_birthdate}")
    elif issue_date:
        dates_list.append(f"إصدار: {issue_date}")

    if dates_list:
        fields.append({"field_key": "dates", "field_label_ar": "تواريخ مذكورة", "field_value": " / ".join(dates_list)})
    elif coerced.get("dates"):
        fields.append({"field_key": "dates", "field_label_ar": "تواريخ مذكورة", "field_value": ", ".join(coerced["dates"])})

    if expiry_date:
        fields.append({"field_key": "expiry_date", "field_label_ar": "تاريخ الانتهاء", "field_value": str(expiry_date)})

    # 5. Amount (only for financial documents)
    if doc_type not in ("national_id", "driving_license", "passport", "birth_certificate", "marriage_certificate", "death_certificate"):
        if amount and str(amount).strip() and str(amount) != "لا يوجد":
            fields.append({"field_key": "amount", "field_label_ar": "المبلغ المطلوب", "field_value": str(amount)})

    # 6. Actions
    if actions:
        fields.append({"field_key": "actions", "field_label_ar": "الإجراءات المطلوبة", "field_value": str(actions)})

    # 7. Additional detailed fields (Name, Address, Governorate, Job)
    from app.services.ocr_service import normalize_text
    if entities.get("name"):
        fields.append({"field_key": "name", "field_label_ar": "الاسم الكامل", "field_value": normalize_text(entities["name"])})
    if entities.get("national_number"):
        fields.append({"field_key": "national_number", "field_label_ar": "الرقم القومي", "field_value": str(entities["national_number"])})
    if entities.get("address"):
        norm_address = normalize_text(entities["address"])
        fields.append({"field_key": "address", "field_label_ar": "العنوان", "field_value": norm_address})
    if entities.get("governorate"):
        fields.append({"field_key": "governorate", "field_label_ar": "المحافظة", "field_value": normalize_text(entities["governorate"])})
    if entities.get("job"):
        fields.append({"field_key": "job", "field_label_ar": "المهنة", "field_value": str(entities["job"])})

    resolved_session_id = str(session_id) if (session_id and not hasattr(session_id, "default")) else None
    user_id = current_user["id"] if current_user else 1

    if doc_type == "national_id":
        with db_connection() as connection:
            connection.execute(
                "DELETE FROM documents WHERE user_id = ? AND (document_type = 'national_id' OR document_type = 'بطاقة رقم قومي')",
                (user_id,),
            )
            connection.commit()

    document_id = store_document(
        resolved_session_id,
        getattr(file, "filename", None) or "document.jpg",
        getattr(file, "content_type", None) or "image/jpeg",
        doc_type,
        summary,
        result.get("ocr_text", ""),
        fields,
        user_id=user_id,
    )

    # Format clean key-value dictionary list for the frontend UI
    api_fields: list[dict[str, str]] = []
    if doc_type_ar:
        api_fields.append({"doc_type": doc_type_ar})
    if entities.get("name"):
        api_fields.append({"name": str(entities["name"])})
    if entities.get("address"):
        api_fields.append({"address": str(entities["address"])})
    if entities.get("governorate"):
        api_fields.append({"governorate": str(entities["governorate"])})
    if entities.get("national_number") or doc_number:
        nid_val = entities.get("national_number") or doc_number
        if len(str(nid_val)) == 14 and str(nid_val).isdigit():
            api_fields.append({"national_number": str(nid_val)})
    if issuer:
        api_fields.append({"issuer": str(issuer)})
    if doc_type == "national_id":
        if doc_number and len(str(doc_number)) == 14 and str(doc_number).isdigit():
            api_fields.append({"doc_number": str(doc_number)})
    elif doc_number:
        api_fields.append({"doc_number": str(doc_number)})
    if dates_list:
        api_fields.append({"dates": " / ".join(dates_list)})
    elif coerced.get("dates"):
        api_fields.append({"dates": ", ".join(coerced["dates"])})
    if expiry_date:
        api_fields.append({"expiry_date": str(expiry_date)})
    if doc_type not in ("national_id", "driving_license", "passport", "birth_certificate", "marriage_certificate", "death_certificate"):
        if amount and str(amount).strip() and str(amount) != "لا يوجد":
            api_fields.append({"amount": str(amount)})
    if actions:
        api_fields.append({"actions": str(actions)})

    next_steps = result.get("next_steps") or suggested_next_steps(doc_type)

    return {
        "document_type": doc_type_ar,
        "summary_arabic": summary,
        "fields": api_fields,
        "next_steps": next_steps,
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
