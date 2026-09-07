from __future__ import annotations

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR / "sahelha.db")))
UPLOAD_DIR = BASE_DIR / "uploads"

# python-jose/passlib aren't installed in every dev environment here, so auth
# is implemented with stdlib hmac (see app/core/security.py) — no new deps.
SECRET_KEY = os.getenv("SECRET_KEY", "sahelha-dev-secret-change-in-production")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

# FCM legacy HTTP API server key for reminder push notifications. Optional —
# reminders still get marked sent on schedule if this isn't configured, the
# push just gets skipped (see app/services/reminder_service.py).
FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY")
REMINDER_CHECK_INTERVAL_SECONDS = int(os.getenv("REMINDER_CHECK_INTERVAL_SECONDS", str(30 * 60)))

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
