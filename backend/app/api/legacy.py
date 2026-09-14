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


    doc_type = result.get("doc_type", "unknown")
    summary = result.get("summary", "")
    entities = result.get("entities", {})

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
    issuer = result.get("issuer") or entities.get("issuer")
    if not issuer and doc_type == "national_id":
        issuer = "قطاع مصلحة الأحوال المدنية - وزارة الداخلية"
    elif not issuer and doc_type == "driving_license":
        issuer = "الإدارة العامة للمرور - وزارة الداخلية"
    elif not issuer and doc_type == "utility_bill":
        issuer = "شركة الخدمات والمرافق"
    if issuer:
        fields.append({"field_key": "issuer", "field_label_ar": "الجهة الحكومية", "field_value": str(issuer)})

    # 3. Document Number
    doc_number = result.get("doc_number") or entities.get("national_number") or entities.get("doc_number")
    if doc_number:
        fields.append({"field_key": "doc_number", "field_label_ar": "رقم المستند", "field_value": str(doc_number)})

    # 4. Dates & Expiry
    issue_date = result.get("issue_date")
    expiry_date = result.get("expiry_date")
    dates_list = []
    if issue_date:
        dates_list.append(f"إصدار: {issue_date}")
    if expiry_date:
        dates_list.append(f"انتهاء: {expiry_date}")
    if dates_list:
        fields.append({"field_key": "dates", "field_label_ar": "تاريخ الإصدار والانتهاء", "field_value": " / ".join(dates_list)})
    elif result.get("dates"):
        fields.append({"field_key": "dates", "field_label_ar": "التواريخ", "field_value": ", ".join(result["dates"])})

    # 5. Amount
    amount = result.get("amount") or (result.get("amounts") and result["amounts"][0])
    if amount and str(amount).strip() and str(amount) != "لا يوجد":
        fields.append({"field_key": "amount", "field_label_ar": "المبلغ المطلوب", "field_value": str(amount)})

    # 6. Actions
    actions = result.get("actions")
    if not actions and doc_type == "national_id":
        actions = "تجديد البطاقة قبل موعد الانتهاء واستخدامها لإثبات الشخصية"
    elif not actions and doc_type == "utility_bill":
        actions = "سداد الفاتورة عبر منافذ الدفع الإلكتروني"
    if actions:
        fields.append({"field_key": "actions", "field_label_ar": "الإجراءات المطلوبة", "field_value": str(actions)})

    # 7. Additional detailed fields (Name, Address, Governorate, Job)
    if entities.get("name"):
        fields.append({"field_key": "name", "field_label_ar": "الاسم الكامل", "field_value": entities["name"]})
    if entities.get("national_number") and str(entities["national_number"]) != str(doc_number):
        fields.append({"field_key": "national_number", "field_label_ar": "الرقم القومي", "field_value": str(entities["national_number"])})
    if entities.get("address"):
        fields.append({"field_key": "address", "field_label_ar": "العنوان", "field_value": entities["address"]})
    if entities.get("governorate"):
        fields.append({"field_key": "governorate", "field_label_ar": "المحافظة", "field_value": entities["governorate"]})
    if entities.get("job"):
        fields.append({"field_key": "job", "field_label_ar": "المهنة", "field_value": entities["job"]})

    resolved_session_id = str(session_id) if (session_id and not hasattr(session_id, "default")) else None
    document_id = store_document(
        resolved_session_id,
        getattr(file, "filename", None) or "document.jpg",
        getattr(file, "content_type", None) or "image/jpeg",
        doc_type,
        summary,
        result.get("ocr_text", ""),
        fields,
    )

    # Format clean key-value dictionary list for the frontend UI
    api_fields: list[dict[str, str]] = []
    if doc_type_ar:
        api_fields.append({"doc_type": doc_type_ar})
    if issuer:
        api_fields.append({"issuer": str(issuer)})
    if doc_number:
        api_fields.append({"doc_number": str(doc_number)})
    if dates_list:
        api_fields.append({"dates": " / ".join(dates_list)})
    elif result.get("dates"):
        api_fields.append({"dates": ", ".join(result["dates"])})
    if amount and str(amount).strip() and str(amount) != "لا يوجد":
        api_fields.append({"amount": str(amount)})
    if actions:
        api_fields.append({"actions": str(actions)})

    # Detail fields in Arabic for leftover rows
    if entities.get("name"):
        api_fields.append({"الاسم": entities["name"]})
    if entities.get("address"):
        api_fields.append({"العنوان": entities["address"]})
    if entities.get("governorate"):
        api_fields.append({"المحافظة": entities["governorate"]})
    if entities.get("job"):
        api_fields.append({"المهنة": entities["job"]})

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
