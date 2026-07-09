from __future__ import annotations

import hashlib
import io
import math
import wave
from datetime import datetime, timezone
from typing import Any

from app.db import db_connection


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_dict(row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def build_hash(*parts: str) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode("utf-8"))
        digest.update(b"::")
    return digest.hexdigest()


def generate_silence_wav(duration_seconds: float = 1.0, sample_rate: int = 16000) -> bytes:
    frame_count = max(1, int(duration_seconds * sample_rate))
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        silence_frame = (0).to_bytes(2, byteorder="little", signed=True)
        wav_file.writeframes(silence_frame * frame_count)
    return buffer.getvalue()


def get_or_create_audio_asset(text: str, language: str = "ar", provider: str = "placeholder") -> str:
    text_hash = build_hash(language, text)
    cache_key = text_hash

    with db_connection() as connection:
        row = connection.execute(
            "SELECT cache_key FROM audio_assets WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()

        if row is None:
            audio_blob = generate_silence_wav(duration_seconds=min(3.0, max(1.0, len(text) / 30.0)))
            connection.execute(
                """
                INSERT INTO audio_assets (cache_key, text_hash, provider, language, content_type, audio_blob, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    cache_key,
                    text_hash,
                    provider,
                    language,
                    "audio/wav",
                    audio_blob,
                    now_iso(),
                ),
            )
            connection.commit()

    return cache_key


def extract_document_fields(text: str) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    for line in text.splitlines():
        normalized = line.strip()
        if not normalized or ":" not in normalized:
            continue
        key, value = normalized.split(":", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            fields.append({"field_key": key, "field_label_ar": key, "field_value": value})
    return fields[:8]


def infer_document_type(text: str, filename: str | None) -> str:
    lower_text = text.lower()
    lower_name = (filename or "").lower()
    if "birth" in lower_text or "ميلاد" in lower_text or "birth" in lower_name:
        return "birth_certificate"
    if "passport" in lower_text or "جواز" in lower_text:
        return "passport"
    if "card" in lower_text or "بطاقة" in lower_text or "id" in lower_name:
        return "national_id"
    if lower_name.endswith(".pdf"):
        return "pdf_document"
    if any(lower_name.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
        return "image_document"
    return "general_document"


def summarize_document(document_type: str, text: str) -> str:
    if document_type == "national_id":
        return "هذه وثيقة هوية. راجع الاسم والرقم وتأكد أن البيانات واضحة وصحيحة."
    if document_type == "birth_certificate":
        return "هذه شهادة ميلاد. استخدمها لإثبات بيانات المولود والبدء في أي خدمة مرتبطة بها."
    if document_type == "passport":
        return "هذه وثيقة سفر. تأكد من صلاحية البيانات والتواريخ قبل استخدامها."
    if text.strip():
        return "هذه وثيقة تحتاج مراجعة. أهم شيء هو التأكد من الاسم والبيانات الأساسية قبل التقديم."
    return "لم أتمكن من قراءة النص بالكامل، لكن هذا المستند يبدو مرتبطًا بخدمة حكومية."


def suggested_next_steps(document_type: str) -> list[str]:
    mapping = {
        "national_id": ["راجع البيانات الأساسية", "اذهب لأقرب سجل مدني"],
        "birth_certificate": ["تأكد من بيانات المولود", "اذهب لمكتب الصحة أو السجل المدني"],
        "passport": ["راجع تاريخ الصلاحية", "استعد للأوراق المطلوبة قبل التقديم"],
    }
    return mapping.get(document_type, ["راجع المستند مع الموظف المختص", "اسأل عن الخطوة التالية في المكتب"])


def store_document(
    session_id: str | None,
    original_name: str | None,
    mime_type: str | None,
    document_type: str,
    summary_arabic: str,
    raw_text: str,
    fields: list[dict[str, str]],
) -> int:
    with db_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO documents (session_id, original_name, mime_type, document_type, summary_arabic, raw_text, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (session_id, original_name, mime_type, document_type, summary_arabic, raw_text, now_iso()),
        )
        document_id = int(cursor.lastrowid)

        if fields:
            connection.executemany(
                """
                INSERT INTO document_fields (document_id, field_key, field_label_ar, field_value)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (document_id, field["field_key"], field["field_label_ar"], field["field_value"])
                    for field in fields
                ],
            )
        connection.commit()

    return document_id


def get_or_create_session(session_id: str | None) -> str:
    resolved_session_id = session_id or build_hash("session", now_iso())[:16]

    with db_connection() as connection:
        row = connection.execute(
            "SELECT id FROM chat_sessions WHERE id = ?",
            (resolved_session_id,),
        ).fetchone()

        if row is None:
            connection.execute(
                "INSERT INTO chat_sessions (id, created_at, last_message_at) VALUES (?, ?, ?)",
                (resolved_session_id, now_iso(), now_iso()),
            )
            connection.commit()

    return resolved_session_id


def store_chat_message(session_id: str, role: str, content: str, audio_url: str | None = None) -> None:
    with db_connection() as connection:
        connection.execute(
            "INSERT INTO chat_messages (session_id, role, content, audio_url, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, role, content, audio_url, now_iso()),
        )
        connection.execute(
            "UPDATE chat_sessions SET last_message_at = ? WHERE id = ?",
            (now_iso(), session_id),
        )
        connection.commit()


def generate_arabic_reply(message: str) -> tuple[str, list[dict[str, str]]]:
    lower_message = message.lower()

    if any(keyword in lower_message for keyword in ["بطاقة", "id", "card"]):
        return (
            "لو هدفك بطاقة الرقم القومي، جهز صورتك الشخصية وإيصال المرافق واذهب للسجل المدني الأقرب.",
            [
                {"label": "بطاقة الرقم القومي", "value": "1"},
                {"label": "أقرب مكتب", "value": "/api/offices/nearby?service_id=1"},
            ],
        )

    if any(keyword in lower_message for keyword in ["ميلاد", "birth"]):
        return (
            "لشهادة الميلاد، أهم شيء هو بيانات المولود بشكل صحيح ثم التوجه لمكتب الصحة أو السجل المدني.",
            [
                {"label": "شهادة الميلاد", "value": "2"},
                {"label": "الخطوات", "value": "/api/services/2/steps"},
            ],
        )

    return (
        "أنا أقدر أساعدك في فهم الورق والخطوات المطلوبة. ابعتلي اسم الخدمة أو صورة المستند وسأشرحها لك ببساطة.",
        [
            {"label": "الخدمات", "value": "/api/services"},
            {"label": "تصوير المستند", "value": "/api/document/analyze"},
        ],
    )


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(a))


__all__ = [
    "build_hash",
    "extract_document_fields",
    "generate_arabic_reply",
    "generate_silence_wav",
    "get_or_create_audio_asset",
    "get_or_create_session",
    "haversine_km",
    "infer_document_type",
    "now_iso",
    "row_to_dict",
    "store_chat_message",
    "store_document",
    "summarize_document",
    "suggested_next_steps",
]
