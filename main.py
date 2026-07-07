from __future__ import annotations

import hashlib
import io
import math
import sqlite3
import wave
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "sahelha.db"


SERVICE_SEED = [
    {"id": 1, "name_ar": "بطاقة الرقم القومي", "icon_emoji": "🪪", "icon_url": None},
    {"id": 2, "name_ar": "شهادة الميلاد", "icon_emoji": "📄", "icon_url": None},
    {"id": 3, "name_ar": "تصريح العمل", "icon_emoji": "💼", "icon_url": None},
]

SERVICE_REQUIREMENTS_SEED = {
    1: [
        "صورة بطاقة الرقم القومي الحالية أو شهادة الميلاد",
        "صورة شخصية حديثة",
        "إيصال مرافق حديث",
    ],
    2: [
        "بيانات المولود كاملة",
        "اسم المستشفى أو جهة القيد",
    ],
    3: [
        "صورة جواز السفر أو بطاقة الرقم القومي",
        "خطاب جهة العمل إن وجد",
    ],
}

SERVICE_STEPS_SEED = {
    1: [
        {"step_order": 1, "icon": "1", "text_ar": "جهز المستندات الأساسية.", "audio_url": None},
        {"step_order": 2, "icon": "2", "text_ar": "اذهب لأقرب سجل مدني.", "audio_url": None},
        {"step_order": 3, "icon": "3", "text_ar": "قدّم الطلب واستلم الإيصال.", "audio_url": None},
    ],
    2: [
        {"step_order": 1, "icon": "1", "text_ar": "اجمع بيانات المولود.", "audio_url": None},
        {"step_order": 2, "icon": "2", "text_ar": "توجه لمكتب الصحة أو السجل المدني.", "audio_url": None},
        {"step_order": 3, "icon": "3", "text_ar": "استلم الشهادة بعد المراجعة.", "audio_url": None},
    ],
    3: [
        {"step_order": 1, "icon": "1", "text_ar": "حدد جهة العمل أو نوع التصريح.", "audio_url": None},
        {"step_order": 2, "icon": "2", "text_ar": "أحضر الأوراق المطلوبة.", "audio_url": None},
        {"step_order": 3, "icon": "3", "text_ar": "قدّم الطلب وخذ موعد الاستلام.", "audio_url": None},
    ],
}

OFFICE_SEED = [
    {
        "id": 1,
        "name_ar": "مكتب سجل مدني العتبة",
        "address_ar": "ميدان العتبة، القاهرة",
        "lat": 30.0514,
        "lng": 31.2467,
        "hours": "8:00 - 14:00",
        "phone": "0221234567",
        "service_ids": [1, 2],
    },
    {
        "id": 2,
        "name_ar": "مركز خدمات مصر الجديدة",
        "address_ar": "مصر الجديدة، القاهرة",
        "lat": 30.0941,
        "lng": 31.3228,
        "hours": "8:00 - 15:00",
        "phone": "0222234567",
        "service_ids": [1, 3],
    },
    {
        "id": 3,
        "name_ar": "مكتب توثيق الجيزة",
        "address_ar": "الجيزة، شارع الهرم",
        "lat": 29.9870,
        "lng": 31.1550,
        "hours": "9:00 - 14:00",
        "phone": "0233345678",
        "service_ids": [2, 3],
    },
]


app = FastAPI(title="Sahelha Backend", version="0.1.0")


class ChatMessageRequest(BaseModel):
    session_id: str | None = None
    message: str = Field(min_length=1)


class ChatMessageResponse(BaseModel):
    session_id: str
    response_text: str
    response_audio_url: str
    action_cards: list[dict[str, str]] = []


class DocumentAnalyzeResponse(BaseModel):
    document_type: str
    summary_arabic: str
    fields: list[dict[str, str]]
    next_steps: list[str]
    document_id: int


class ReadDocumentResponse(BaseModel):
    text: str
    audio_url: str
    cached: bool


class ServiceCategory(BaseModel):
    id: int
    name_ar: str
    icon_emoji: str
    icon_url: str | None = None


class NearbyOffice(BaseModel):
    id: int
    name_ar: str
    address_ar: str
    coords: dict[str, float]
    hours: str
    phone: str
    distance_km: float


@contextmanager
def db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
    finally:
        connection.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def table_count(connection: sqlite3.Connection, table_name: str) -> int:
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()
    return int(row["count"] if row else 0)


def seed_if_empty(connection: sqlite3.Connection) -> None:
    if table_count(connection, "service_categories") == 0:
        connection.executemany(
            """
            INSERT INTO service_categories (id, name_ar, icon_emoji, icon_url)
            VALUES (:id, :name_ar, :icon_emoji, :icon_url)
            """,
            SERVICE_SEED,
        )

    if table_count(connection, "service_requirements") == 0:
        rows: list[dict[str, Any]] = []
        for service_id, requirements in SERVICE_REQUIREMENTS_SEED.items():
            for order, requirement in enumerate(requirements, start=1):
                rows.append(
                    {
                        "service_id": service_id,
                        "item_order": order,
                        "document_text_ar": requirement,
                    }
                )
        connection.executemany(
            """
            INSERT INTO service_requirements (service_id, item_order, document_text_ar)
            VALUES (:service_id, :item_order, :document_text_ar)
            """,
            rows,
        )

    if table_count(connection, "service_steps") == 0:
        rows = []
        for service_id, steps in SERVICE_STEPS_SEED.items():
            for step in steps:
                rows.append({"service_id": service_id, **step})
        connection.executemany(
            """
            INSERT INTO service_steps (service_id, step_order, icon, text_ar, audio_url)
            VALUES (:service_id, :step_order, :icon, :text_ar, :audio_url)
            """,
            rows,
        )

    if table_count(connection, "offices") == 0:
        connection.executemany(
            """
            INSERT INTO offices (id, name_ar, address_ar, lat, lng, hours, phone)
            VALUES (:id, :name_ar, :address_ar, :lat, :lng, :hours, :phone)
            """,
            [
                {key: office[key] for key in ["id", "name_ar", "address_ar", "lat", "lng", "hours", "phone"]}
                for office in OFFICE_SEED
            ],
        )

    if table_count(connection, "office_services") == 0:
        rows = []
        for office in OFFICE_SEED:
            for service_id in office["service_ids"]:
                rows.append({"office_id": office["id"], "service_id": service_id})
        connection.executemany(
            """
            INSERT INTO office_services (office_id, service_id)
            VALUES (:office_id, :service_id)
            """,
            rows,
        )

    connection.commit()


def init_db() -> None:
    with db_connection() as connection:
        connection.executescript(
            """
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
        )
        seed_if_empty(connection)


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
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


@app.on_event("startup")
def startup_event() -> None:
    init_db()


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
    return {
        "text": text,
        "audio_url": f"/api/audio/{cache_key}",
        "cached": True,
    }


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

    return {
        "language": language,
        "transcript": transcript,
        "provider": "placeholder",
        "ready_for_chat": True,
    }