from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, List, Dict

from app.db import db_connection
from app.services.rag_service import search_government_rag, format_rag_context_for_llm

# ---------------------------------------------------------------------------
# CJK & Artifact Sanitization Helper
# ---------------------------------------------------------------------------

def _sanitize_text(text: str) -> str:
    if not text:
        return "عذراً، لم أتمكن من فهم السؤال بوضوح. هل يمكنك إعادة التوضيح؟"
    # Strip Chinese / East Asian CJK unicode ranges that sometimes leak from quantized 3B models
    cleaned = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf\u2e80-\u2eff]', '', text)

    # Post-processing fixes for 3B LLM dialect leaks (Sudanese / Upper Egyptian words)
    cleaned = re.sub(r'\bديل\b', 'دول', cleaned)
    cleaned = re.sub(r'\bديلك\b', 'دول', cleaned)
    cleaned = re.sub(r'\bهايك\b', 'أدي', cleaned)

    # Clean up redundant repeats like "أنت عايز تطلع..." at the beginning
    cleaned = re.sub(r'^\s*أنت عايز تطلع\s*', 'لاستخراج ', cleaned)
    cleaned = re.sub(r'^\s*أنت عايز تجدد\s*', 'لتجديد ', cleaned)

    res = cleaned.strip()
    if not res:
        return "عذراً، لم أتمكن من فهم السؤال بوضوح. هل يمكنك إعادة التوضيح؟"
    return res

# ---------------------------------------------------------------------------
# Session handling
# ---------------------------------------------------------------------------

def get_or_create_session(user_id: int, document_id: int | None = None, session_id: str | None = None) -> str:
    """Return an existing session ID (scoped to this user + document) or create a new one."""
    with db_connection() as conn:
        if session_id:
            row = conn.execute(
                "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND (document_id = ? OR (? IS NULL AND document_id IS NULL))",
                (session_id, user_id, document_id, document_id),
            ).fetchone()
            if row:
                return session_id

        new_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO chat_sessions (id, created_at, last_message_at, user_id, document_id) VALUES (?, ?, ?, ?, ?)",
            (new_id, now, now, user_id, document_id),
        )
        conn.commit()
        return new_id


# ---------------------------------------------------------------------------
# Message persistence
# ---------------------------------------------------------------------------

def store_message(
    session_id: str,
    role: str,
    content: str,
    audio_url: str | None = None,
) -> int:
    """Insert a chat message, update session timestamp, and return the message ID."""
    clean_content = _sanitize_text(content)
    with db_connection() as conn:
        now = datetime.utcnow().isoformat()
        cur = conn.execute(
            """
            INSERT INTO chat_messages (session_id, role, content, audio_url, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, role, clean_content, audio_url, now),
        )
        conn.execute(
            "UPDATE chat_sessions SET last_message_at = ? WHERE id = ?",
            (now, session_id)
        )
        conn.commit()
        return cur.lastrowid


# ---------------------------------------------------------------------------
# History retrieval (last N messages, oldest first)
# ---------------------------------------------------------------------------

def fetch_history(session_id: str, limit: int = 10) -> List[Dict[str, str]]:
    """Return the most recent *limit* messages ordered chronologically."""
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT role, content FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
        history = []
        for row in rows:
            clean_c = _sanitize_text(row["content"])
            if clean_c:
                history.append({"role": row["role"], "content": clean_c})
        return history


EGYPTIAN_GOVERNMENT_KNOWLEDGE_BASE = {
    "بطاقة الرقم القومي": {
        "الأوراق المطلوبة": ["صورة شهادة الميلاد أو البطاقة القديمة", "صورة شخصية حديثة (خلفية بيضاء)", "إيصال مرافق (كهرباء أو مياه أو غاز)"],
        "الخطوات": ["اشتري استمارة الرقم القومي من أقرب سجل مدني", "املأ البيانات وأرفق الأوراق المطلوبة", "سجل البصمة والصورة في السجل المدني وادفع الرسوم واستلم الإيصال"],
        "الرسوم والمدة": "الاستمارة العادية (50 جنيه - استلام بعد 15 يوم)، العاجلة (125 جنيه - بعد 3 أيام)، الفورية (175 جنيه - استلام 24 ساعة)"
    },
    "رخصة": {
        "الأوراق المطلوبة": ["بطاقة الرقم القومي سارية", "شهادة فحص طبي (باطنة وعيون)", "4 صور شخصية", "مؤهل دراسي"],
        "الخطوات": ["توجه لوحدة المرور التابع لها محل إقامتك", "ادفع رسوم النموذج وأجرِ الفحص والنظري والعملي", "استلم رخصة القيادة (سارية لمدة 10 سنوات)"],
        "الرسوم والمدة": "تختلف حسب نوع المركبة وتدفع بوحدة المرور"
    },
    "شهادة وفاة": {
        "الأوراق المطلوبة": ["تبليغ الوفاة الصادر من المستشفى أو مكتب الصحة", "بطاقة الرقم القومي للمتوفى وللمبلغ"],
        "الخطوات": ["القيد بمكتب الصحة التابع لمكان الوفاة أولاً", "استخراج الشهادة المميكنة من أي مكتب سجل مدني"],
        "الرسوم والمدة": "مجاناً للمرة الأولى من مكتب الصحة، أو رسوم رمزية للشهادة المميكنة من السجل المدني"
    },
    "شهادة ميلاد": {
        "الأوراق المطلوبة": ["بطاقة الرقم القومي للوالدين", "وثيقة الزواج"],
        "الخطوات": ["التبليغ بمكتب الصحة خلال 15 يوم من الولادة", "استخراج الشهادة المميكنة من السجل المدني"],
        "الرسوم والمدة": "رسوم رمزية للنسخة المميكنة"
    },
    "سجل ضريبي": {
        "الأوراق المطلوبة": ["بطاقة الرقم القومي سارية", "عقد إيجار أو تمليك للمكان (مثبت تاريخه)", "إيصال مرافق حديث (كهرباء أو مياه)"],
        "الخطوات": ["التوجه لمأمورية الضرائب التابع لها مقر النشاط", "تقديم الطلب وفتح ملف ضريبي", "معاينة المقر واستلام البطاقة الضريبية"],
        "الرسوم والمدة": "مجاناً استخراج البطاقة الضريبية وتصدر خلال 15-30 يوم"
    },
    "سجل تجاري": {
        "الأوراق المطلوبة": ["البطاقة الضريبية أو إشعار فتح الملف", "بطاقة الرقم القومي لصاحب النشاط", "عقد الشركة أو المنشأة الفردية"],
        "الخطوات": ["التوجه لمكتب الغرفة التجارية لاستخراج شهادة المزاولة", "التوجه لمكتب السجل التجاري وتقديم المستندات ودفع الرسوم", "استلام مستخرج السجل التجاري"],
        "الرسوم والمدة": "الرسوم تبدأ من 100 إلى 200 جنيه حسب رأس المال، والاستلام في نفس اليوم أو اليوم التالي"
    }
}

def _retrieve_government_facts(query: str) -> str:
    for service_key, details in EGYPTIAN_GOVERNMENT_KNOWLEDGE_BASE.items():
        if service_key in query or any(k in query for k in service_key.split() if len(k) > 2):
            facts = f"المعلومات الرسمية المعتمدة لخدمة ({service_key}):\n"
            facts += f"- الأوراق المطلوبة: {', '.join(details['الأوراق المطلوبة'])}\n"
            facts += f"- الخطوات: {', '.join(details['الخطوات'])}\n"
            facts += f"- الرسوم والمدة: {details['الرسوم والمدة']}\n"
            return facts
    return ""

ASSISTANT_SYSTEM_PROMPT = """\
أنت "سهلها عليا" — مساعد صوتي مصري ذكي وودود وموجز، متخصص في مساعدة المواطنين في الأوراق والمعاملات الحكومية المصرية.

قواعد صارمة للإجابة والتزام الحقائق (إلزامي):
1. التزم بنسبة 100% بالمستندات والخطوات والشروط المرفقة لك فقط من منصة (مصر الرقمية digital.gov.eg) دون إضافة أو اختلاق أي مستندات خارجية!
2. يمنع تماماً استخدام كلمة "اشترى" أو "شراء" لوصف التجهيزات أو الأوراق المطلوبة (استخدم كلمات مثل: "إحضار"، "تقديم"، "صورة"، "أصل").
3. يمنع إضافة مستندات عامة (مثل إيصال مرافق، شهادة ميلاد، إثبات مهنة، أو صورة شخصية) لخدمات لا تطلبها صراحة في الحقائق المرفقة.
4. طابق فعل المستخدم تماماً: إذا طلب "استخراج/أطلع" أجب "لاستخراج..."، وإذا طلب "تجديد" أجب "لتجديد...". يمنع إعادة الجملة بـ "أنت عايز...".
5. ابدأ الإجابة مباشرة وبشكل ودود وموجز جداً (في أسلوب عامية قاهرية سليمة مثل: "دي"، "دول"، وممنوع ألفاظ مثل "ديل" أو "هايك").
6. ميز بدقة بين تجديد رخصة المركبة ورخصة القيادة الشخصية.
7. أجب في 2 إلى 3 أسطر فقط باللغة العربية.
"""

# ---------------------------------------------------------------------------
# LLM invocation for Q&A
# ---------------------------------------------------------------------------

def ask_ai(document_text: str, history: List[Dict[str, str]], question: str) -> str:
    """Call Groq or local LLM to answer *question* using *document_text* as context."""
    from app.services.ai_service import chat_completion
    system_prompt = ASSISTANT_SYSTEM_PROMPT

    # 1. Digital Egypt RAG Dataset Match
    matched_rag = search_government_rag(question)
    if matched_rag:
        retrieved_facts = format_rag_context_for_llm(matched_rag)
        system_prompt += (
            "\n\nاستخدم الحقائق الرسمية المعتمدة التالية من منصة (مصر الرقمية digital.gov.eg) للإجابة بكل دقة:\n"
            + retrieved_facts
        )
    elif document_text and document_text.strip():
        system_prompt += (
            "\n\nلديك نص المستند المستخرج كخلفية للإجابة على سؤال المستخدم:\n"
            + document_text.strip()
        )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": question})

    ans = chat_completion(messages, temperature=0.2, max_tokens=1024)
    return _sanitize_text(ans)


__all__ = [
    "get_or_create_session",
    "store_message",
    "fetch_history",
    "ask_ai",
]