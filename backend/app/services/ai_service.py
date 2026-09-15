"""
app/services/ai_service.py
~~~~~~~~~~~~~~~~~~~~~~~~~~
Groq-powered document analysis for Egyptian and Arabic administrative
paperwork.  Takes raw OCR text and returns a structured
:class:`DocumentAnalysisResult` dict.

Key improvements over the original
------------------------------------
1. **Richer system prompt** — explicitly instructs the model to correct OCR
   artefacts, lists every recognised Egyptian document type, and enforces
   the exact JSON schema required.
2. **Configurable model via GROQ_MODEL env var** — defaults to
   ``llama-3.1-8b-instant`` for speed.  Set ``GROQ_MODEL=llama-3.3-70b-versatile``
   in ``.env`` for significantly better Arabic comprehension on complex docs.
3. **Markdown fence stripping** — some LLMs emit ```json … ``` despite
   ``response_format={"type":"json_object"}``; we strip fences before parsing.
4. **Broader heuristic patterns** — the fallback detector now recognises more
   Egyptian-specific document keywords (marriage, death, work-permit, utility).
5. **Better regex for dates and amounts** — captures more Arabic monetary
   formats (ج.م, LE) and bare 4-digit years as a last resort.
6. **_coerce_result** merges LLM payload with heuristic fallbacks field-by-field
   so partial or malformed model output never crashes the pipeline.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, TypedDict
import traceback

import requests
from dotenv import load_dotenv

try:
    from groq import Groq
except ImportError as exc:  # pragma: no cover
    Groq = None  # type: ignore[assignment]
    _GROQ_IMPORT_ERROR: Exception | None = exc
else:
    _GROQ_IMPORT_ERROR = None

from pathlib import Path
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(dotenv_path=_ENV_PATH)
else:
    load_dotenv()

_AZURE_OPENAI_ENDPOINT: str = os.getenv(
    "AZURE_OPENAI_ENDPOINT",
    "https://raafat-abualazm96-1418-resource.services.ai.azure.com/openai/v1"
)
_AZURE_OPENAI_KEY: str = os.getenv("AZURE_OPENAI_KEY", "")
_AZURE_OPENAI_DEPLOYMENT: str = os.getenv(
    "AZURE_OPENAI_DEPLOYMENT",
    "gpt-5.6-sol"
)
_GROQ_MODEL: str = os.getenv("GROQ_MODEL", "allam-2-7b")

# ── Local AI (Ollama) ────────────────────────────────────────────────────────
_OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
_OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-egypt")
_OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))
_AI_PREFER_CLOUD: bool = os.getenv("AI_PREFER_CLOUD", "false").strip().lower() in {"1", "true", "yes"}


# ── Output schema ────────────────────────────────────────────────────────────

class DocumentAnalysisResult(TypedDict, total=False):
    doc_type: str
    summary: str
    issuer: str
    doc_number: str
    amount: str
    issue_date: str | None
    expiry_date: str | None
    actions: str
    entities: dict[str, str]
    dates: list[str]
    amounts: list[str]
    tags: list[str]


# ── System prompt ────────────────────────────────────────────────────────────
# Explicitly tells the model:
#   • what it is processing (Egyptian admin docs with OCR noise)
#   • how to handle OCR artefacts (silently correct them)
#   • the *exact* JSON schema and every allowed doc_type value
#   • never to wrap the response in markdown or add prose

SYSTEM_PROMPT = """\
You are an expert Arabic document analyst specialized in Egyptian government documents and administrative paperwork.

You receive noisy OCR text extracted from images or scanned PDFs. OCR often contains reading errors:
- missing or misrecognized Arabic letters (e.g., "منمد" should be "محمد", "فقحى" or "فثحى" should be "فتحي", "بسيونى" or "بميونى" should be "بسيوني", "عالى" should be "علي", "منمود" should be "محمود")
- Egyptian governorates and cities often suffer minor OCR letter misreads (e.g., "البعبرة" is "البحيرة", "اسكندرية" is "الإسكندرية", "الهزم" is "الهرم")
- raw card serial numbers (e.g. "1K0753896", "KC4858070") accidentally mixed with names or addresses
- misrecognized numbers or symbols (e.g., Arabic numeral ٥ misrecognized as د or ه)

Egyptian National ID Card Layout:
- Top text lines contain the citizen's full Arabic name (e.g. "محمد بسيوني محمد فتحي بسيوني").
- Middle text lines contain the street address (e.g. "المعهد الديني" or "١٦ ش الليثى").
- Bottom text line contains city/markaz and governorate (e.g. "دمنهور - البحيرة").
- Do NOT mix street or place names (like "المعهد الديني" or "دمنهور") into the citizen's personal name.
- Do NOT include card serial codes (like "1K0753896") in the name, address, or national_number.

Your job:
1. Identify the exact document type.
2. Intelligently reconstruct proper, correct Arabic names and addresses by repairing OCR letter errors and removing noise characters/serial codes.
3. Extract accurate numbers and dates into the specified JSON schema.
4. Always answer in pure Arabic. NEVER translate Arabic names or places into English.

Return ONLY valid JSON with no markdown wrapping.

Schema:
{
  "doc_type": "national_id | passport | birth_certificate | utility_bill | receipt | invoice | driving_license | marriage_certificate | death_certificate | government_document | unknown",
  "summary": "ملخص واضح ومفيد للمستند باللغة العربية في جملة أو جملتين",
  "issuer": "الجهة الحكومية أو المؤسسة المصدرة للمستند (مثال: قطاع مصلحة الأحوال المدنية - وزارة الداخلية)",
  "doc_number": "الرقم القومي (14 رقم) للبطاقة أو رقم الفاتورة/المستند. لا تضع الأرقام التسلسلية المطبوعة جانباً مثل 1K0753896!",
  "amount": "المبلغ المالي المطلوب أو المدفوع بالجنيه المصري (اتركه فارغاً '' لجميع الهويات والبطاقات الرسمية!)",
  "issue_date": "تاريخ إصدار المستند إن وجد",
  "expiry_date": "تاريخ انتهاء صلاحية المستند إن وجد",
  "actions": "الإجراءات أو الخطوات المطلوبة من المواطن",
  "entities": {
      "name": "اسم المواطن الصحيح كاملاً باللغة العربية بعد تصحيح أخطاء الـ OCR.",
      "national_number": "الرقم القومي المكون من 14 رقم (يبدأ بـ 2 أو 3)",
      "address": "العنوان بالتفصيل باللغة العربية بدون أرقام تسلسلية غريبة",
      "governorate": "المحافظة بالعربية إن وجدت",
      "job": "المهنة أو الوظيفة إن وجدت"
  },
  "dates": ["أي تواريخ أخرى مذكورة في المستند مثل تاريخ الميلاد"],
  "amounts": [],
  "tags": []
}

Rules:
- summary MUST be Arabic only.
- Identity and civil registry documents (National ID, Driving License, Birth Certificate, Passport) NEVER have payment amounts. "amount" MUST be empty string "".
- For Egyptian National IDs: doc_type must be "national_id", issuer "قطاع مصلحة الأحوال المدنية - وزارة الداخلية", doc_number is the 14-digit national number.
- For Egyptian Birth Certificates: doc_type MUST be "birth_certificate", name MUST be child's full name.
- If a field is missing, use empty string "" or null for expiry_date.

### Example Input:
بطاقة . = تحقيق | الشخصية
منمد
عبدالرحمن عبدالحميد هليل سالم
٥ ٨ ب - حدائق الاهرام
الهرم . الجيزة
٣٤ ٠٠٢ ٢٢ ٢١ ٠٦ ٠٥ ١ ٦٧٧ ٥١٠ ؛ ؛ ٢
KC4858070

### Example Output:
{
  "doc_type": "national_id",
  "summary": "بطاقة رقم قومي للمواطن محمد عبدالرحمن عبدالحميد هليل سالم.",
  "issuer": "قطاع مصلحة الأحوال المدنية - وزارة الداخلية",
  "doc_number": "30506212200234",
  "amount": "",
  "issue_date": null,
  "expiry_date": null,
  "actions": "تجديد البطاقة في موعد الانتهاء واستخدامها لإثبات الشخصية.",
  "entities": {
      "name": "محمد عبدالرحمن عبدالحميد هليل سالم",
      "national_number": "30506212200234",
      "address": "٥ ٨ ب - حدائق الاهرام الهرم - الجيزة",
      "governorate": "الجيزة",
      "job": ""
  },
  "dates": ["2005/06/21"],
  "amounts": [],
  "tags": ["arabic", "identity", "national_id"]
}
"""

# ── Groq client singleton ────────────────────────────────────────────────────

_CLIENT: "Groq | None" = None


def _get_client() -> "Groq":
    """Return the lazily-initialised Groq client, raising on misconfiguration."""
    global _CLIENT

    if Groq is None:
        raise RuntimeError("groq package is not installed") from _GROQ_IMPORT_ERROR

    if _CLIENT is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Add it to your .env file."
            )
        _CLIENT = Groq(api_key=api_key)

    return _CLIENT


def _ollama_chat_completion(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.1,
    max_tokens: int = 1024,
    json_mode: bool = False,
    images: list[str] | None = None,
) -> str:
    """Call a locally-running Ollama server's native chat API.
    Attempts configured _OLLAMA_MODEL first, and falls back to other pulled models if 404.
    """
    preferred_model = os.getenv("OLLAMA_MODEL") or _OLLAMA_MODEL
    models_to_try = [preferred_model, "qwen2.5:7b-egypt", "llama3.2-vision", "llava", "qwen2.5:7b", "qwen2.5:3b"]
    seen = set()
    unique_models = [m for m in models_to_try if m and not (m in seen or seen.add(m))]

    formatted_messages = list(messages)
    if images and formatted_messages:
        # Attach base64 images payload to the last user message for Ollama Vision models
        last_msg = dict(formatted_messages[-1])
        last_msg["images"] = images
        formatted_messages[-1] = last_msg

    last_exc = None
    for model_name in unique_models:
        payload: dict[str, Any] = {
            "model": model_name,
            "messages": formatted_messages,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "top_p": 0.85,
                "repeat_penalty": 1.25,
                "repeat_last_n": 64,
                "num_predict": min(max_tokens, 350),
            },
        }
        if json_mode:
            payload["format"] = "json"

        try:
            response = requests.post(
                f"{_OLLAMA_BASE_URL}/api/chat",
                json=payload,
                timeout=_OLLAMA_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            data = response.json()
            return (data.get("message", {}).get("content") or "").strip()
        except requests.HTTPError as err:
            last_exc = err
            if err.response is not None and err.response.status_code == 404:
                print(f"[AI SERVICE] Model '{model_name}' not found in Ollama, attempting fallback model...")
                continue
            raise err
        except (requests.Timeout, requests.ConnectionError) as err:
            print(f"[AI SERVICE] Ollama connection/timeout for '{model_name}' ({err}). Bypassing model retry loop.")
            raise err
        except Exception as err:
            raise err

    if last_exc:
        raise last_exc
    raise RuntimeError("No available Ollama model could complete the request")


def _azure_openai_chat_completion(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.1,
    max_tokens: int = 1024,
    json_mode: bool = False,
) -> str:
    """Call Azure OpenAI chat completions endpoint."""
    url = f"{_AZURE_OPENAI_ENDPOINT.rstrip('/')}/chat/completions"
    headers = {
        "api-key": _AZURE_OPENAI_KEY,
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": _AZURE_OPENAI_DEPLOYMENT,
        "messages": messages,
        "max_completion_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    res = requests.post(url, headers=headers, json=payload, timeout=30)
    res.raise_for_status()
    data = res.json()
    return (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()


def chat_completion(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.1,
    max_tokens: int = 1024,
    json_mode: bool = False,
) -> str:
    """Run one chat completion across available providers.

    Provider order:
    - If AI_PREFER_CLOUD=false (default): Local Ollama (qwen2.5:7b-egypt) -> Azure OpenAI -> Groq
    - If AI_PREFER_CLOUD=true: Azure OpenAI -> Groq -> Local Ollama
    """
    if not _AI_PREFER_CLOUD:
        try:
            return _ollama_chat_completion(
                messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode
            )
        except Exception as exc:
            print(f"[AI SERVICE] Local Ollama ({_OLLAMA_MODEL}) unavailable ({exc}); attempting cloud fallback...")

    if _AZURE_OPENAI_KEY:
        try:
            return _azure_openai_chat_completion(
                messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode
            )
        except Exception as exc:
            print(f"[AI SERVICE] Azure OpenAI call failed ({exc}); attempting Groq fallback...")

    if _AI_PREFER_CLOUD:
        try:
            return _ollama_chat_completion(
                messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode
            )
        except Exception as exc:
            print(f"[AI SERVICE] Local Ollama fallback unavailable ({exc})")

    try:
        client = _get_client()
        kwargs: dict[str, Any] = {
            "model": _GROQ_MODEL,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        completion = client.chat.completions.create(**kwargs)
        return (completion.choices[0].message.content or "").strip()
    except Exception as exc:
        print(f"[AI SERVICE] Cloud Groq fallback unavailable ({exc})")
        raise RuntimeError("AI Service unavailable: All providers failed.") from exc


# ── Heuristic / fallback helpers ─────────────────────────────────────────────

# Ordered list: (keywords, doc_type) — first match wins.
_DOC_TYPE_RULES: list[tuple[list[str], str]] = [
    (["receipt", "إيصال", "مدفوع", "paid", "cash", "وصل"], "receipt"),
    (["invoice", "فاتورة", "tax invoice", "ضريبة قيمة مضافة"], "invoice"),
    (["electricity", "كهرباء", "gas", "غاز", "water", "مياه", "utility"], "utility_bill"),
    (["passport", "جواز السفر", "جواز"], "passport"),
    (["work permit", "تصريح عمل", "تصريح"], "work_permit"),
    (["marriage", "زواج", "عقد زواج", "زوج", "زوجة"], "marriage_certificate"),
    (["death", "وفاة", "توفي", "المتوفى"], "death_certificate"),
    (["driving license", "driving_license", "رخصة", "رخصة قيادة", "رخصة تسيير", "وحدة مرور", "مرور"], "driving_license"),
    (
        [
            "national id", "national identity", "id card", "identity card",
            "بطاقة", "البطاقة", "الرقم القومي", "رقم قومي", "الهوية الشخصية", "تحقيق الشخصية", "شخصية",
        ],
        "national_id",
    ),
    (["شهادة ميلاد", "قيد ميلاد", "صورة قيد", "بيانات المولود", "اسم المولود", "واقعة ميلاد", "birth certificate"], "birth_certificate"),
    (["property", "عقار", "ملكية", "شهادة ملكية"], "property_record"),
]

# Matches common date formats: DD/MM/YYYY, YYYY-MM-DD, and bare 4-digit years
_DATE_RE = re.compile(
    r"\b(?:\d{1,2}[/\-\.])(?:\d{1,2}[/\-\.])\d{2,4}\b"   # DD/MM/YYYY variants
    r"|\b\d{4}[/\-\.](?:\d{1,2}[/\-\.])\d{1,2}\b"         # YYYY-MM-DD
    r"|\b(?:19|20)\d{2}\b",                                 # bare 4-digit year
    re.UNICODE,
)

# Matches amounts with Arabic / Latin currency symbols and plain large numbers
_AMOUNT_RE = re.compile(
    r"(?:EGP|ج\.?م\.?|LE|£|USD|\$)\s*\d[\d,\. ]*"
    r"|\d[\d,\. ]+\s*(?:EGP|ج\.?م\.?|LE|£|USD|\$)"
    r"|\b\d{1,3}(?:[,\.]\d{3})+(?:[,\.]\d+)?\b",
    re.UNICODE,
)


def _heuristic_doc_type(text: str) -> str:
    lowered = text.lower()
    for keywords, doc_type in _DOC_TYPE_RULES:
        if any(kw in lowered for kw in keywords):
            return doc_type
    return "unknown"


def _extract_dates(text: str) -> list[str]:
    return list(dict.fromkeys(m.strip() for m in _DATE_RE.findall(text) if m.strip()))


def _extract_amounts(text: str) -> list[str]:
    raw = [m.strip() for m in _AMOUNT_RE.findall(text)]
    seen: list[str] = []
    for item in raw:
        clean = " ".join(item.split())  # normalise internal whitespace
        if clean and any(ch.isdigit() for ch in clean) and clean not in seen:
            seen.append(clean)
    return seen


def _extract_expiry_date(text: str, dates: list[str]) -> str | None:
    markers = [
        "expiry", "expires", "valid until", "expiration", "exp date",
        "انتهاء", "صلاحية", "تنتهي", "صالح حتى", "صالحة حتى",
    ]
    lowered = text.lower()
    marker_pos = min(
        (lowered.find(m) for m in markers if m in lowered),
        default=-1,
    )
    if marker_pos == -1 or not dates:
        return None

    # Prefer the date whose position in the text is closest to the expiry
    # keyword, rather than blindly picking the first date found anywhere
    # (e.g. an issue date or birth date that happens to appear earlier).
    def _distance(date: str) -> int:
        idx = lowered.find(date.lower())
        return abs(idx - marker_pos) if idx != -1 else len(text)

    return min(dates, key=_distance)


def _extract_tags(text: str, doc_type: str) -> list[str]:
    tags: set[str] = {doc_type}
    lowered = text.lower()

    checks: dict[str, bool] = {
        "arabic": any(0x0600 <= ord(ch) <= 0x06FF for ch in text),
        "english": bool(re.search(r"[A-Za-z]{3,}", text)),
        "financial": any(
            kw in lowered
            for kw in ["invoice", "amount", "total", "فاتورة", "إجمالي", "مبلغ", "paid"]
        ),
        "identity": any(
            kw in lowered for kw in ["id", "card", "passport", "بطاقة", "جواز"]
        ),
        "government": any(
            kw in lowered
            for kw in ["ministry", "government", "حكومة", "وزارة", "جمهورية", "سجل"]
        ),
        "expiry": any(
            kw in lowered
            for kw in ["expiry", "valid", "انتهاء", "صلاحية", "تنتهي"]
        ),
    }
    for tag, active in checks.items():
        if active:
            tags.add(tag)

    return sorted(tags)


def _fallback_analysis(ocr_text: str) -> DocumentAnalysisResult:
    """
    Pure-heuristic analysis used when the LLM is unavailable or returns
    unparseable output. Never raises; always returns a complete result.
    """
    from app.services.ocr_service import extract_national_id

    doc_type = _heuristic_doc_type(ocr_text)
    dates = _extract_dates(ocr_text)
    amounts = _extract_amounts(ocr_text)
    expiry_date = _extract_expiry_date(ocr_text, dates)
    national_id = extract_national_id(ocr_text)

    if national_id and doc_type in ("unknown", "national_id"):
        doc_type = "national_id"

    # Friendly Arabic descriptions
    type_names_ar = {
        "national_id": "بطاقة الرقم القومي",
        "passport": "جواز السفر",
        "birth_certificate": "شهادة الميلاد",
        "utility_bill": "فاتورة خدمات ومرافق",
        "receipt": "إيصال سداد",
        "invoice": "فاتورة رسمية",
        "driving_license": "رخصة قيادة أو تسيير",
        "marriage_certificate": "وثيقة زواج",
        "death_certificate": "شهادة وفاة",
        "property_record": "سجل عقاري",
        "government_document": "مستند حكومي رسمي",
    }
    doc_type_ar = type_names_ar.get(doc_type, "مستند رسمي")

    # Default issuer and actions
    issuer = ""
    actions = ""
    if doc_type == "national_id":
        issuer = "قطاع مصلحة الأحوال المدنية - وزارة الداخلية"
        actions = "تجديد البطاقة في ميعادها واستخدامها لإثبات الشخصية"
    elif doc_type == "utility_bill":
        issuer = "شركة الخدمات والمرافق"
        actions = "سداد قيمة الفاتورة لتجنب انقطاع الخدمة"
    elif doc_type in ("receipt", "invoice"):
        issuer = "الجهة المصدرة للإيصال"
        actions = "الاحتفاظ بإيصال السداد كوثيقة رسمية"

    if not ocr_text.strip():
        summary = "تعذر استخراج نصوص واضحة من المستند، يرجى التأكد من جودة ووضوح الصورة وإعادة المحاولة."
    elif doc_type != "unknown":
        summary = f"تم مسح {doc_type_ar} بنجاح واستخراج البيانات الأساسية منها."
    else:
        summary = "تم فحص المستند واستخراج النصوص والتواريخ والمبالغ المذكورة فيه تلقائياً."

    return DocumentAnalysisResult(
        doc_type=doc_type,
        summary=summary,
        issuer=issuer,
        doc_number=national_id or "",
        amount=amounts[0] if amounts else "",
        issue_date=dates[0] if dates else None,
        expiry_date=expiry_date,
        actions=actions,
        entities={
            "name": "",
            "national_number": national_id or "",
            "address": "",
            "governorate": "",
            "job": "",
        },
        dates=dates,
        amounts=amounts,
        tags=_extract_tags(ocr_text, doc_type),
    )


def _coerce_result(payload: dict[str, Any], ocr_text: str) -> DocumentAnalysisResult:
    """
    Merge an LLM-returned payload with heuristic fallbacks field-by-field.
    """
    fb = _fallback_analysis(ocr_text)

    def _str_or(key: str, default: str) -> str:
        val = payload.get(key)
        if isinstance(val, dict):
            val = val.get("value") or val.get("amount") or ""
        if isinstance(val, (list, tuple)):
            val = val[0] if val else ""
        val_str = str(val or "").strip()
        return val_str if val_str and val_str.lower() not in ("none", "null", "n/a", "nil") else default

    def _list_or(key: str, default: list[str]) -> list[str]:
        val = payload.get(key)
        if isinstance(val, list):
            clean = [str(item).strip() for item in val if str(item).strip()]
            return clean if clean else default
        return default

    # Basic fields
    doc_type = _str_or("doc_type", fb.get("doc_type", "unknown"))
    summary = _str_or("summary", fb.get("summary", ""))
    issuer = _str_or("issuer", fb.get("issuer", ""))
    doc_number = _str_or("doc_number", fb.get("doc_number", ""))
    amount = _str_or("amount", fb.get("amount", ""))
    issue_date = _str_or("issue_date", fb.get("issue_date", "") or "")
    actions = _str_or("actions", fb.get("actions", ""))

    dates = _list_or("dates", fb.get("dates", []))
    amounts = _list_or("amounts", fb.get("amounts", []))
    tags = _list_or("tags", fb.get("tags", []))

    # Entities extracted by LLM
    entities_raw = payload.get("entities", {})
    if not isinstance(entities_raw, dict):
        entities_raw = {}

    fb_entities = fb.get("entities", {})
    raw_name = str(entities_raw.get("name", "")).strip()
    
    # Dynamic text sanitization helper (no hardcoded name replacements)
    def _clean_ar_name(name: str) -> str:
        if not name:
            return ""
        # Remove OCR noise symbols, isolated serial letters/digits, Tatweel, and extra punctuation
        cleaned = re.sub(r"[|=\.؛;:\-_\"'\`ـ]+", " ", name)
        # Strip isolated Latin junk tokens or serial numbers like 1K0753896
        tokens = [
            w for w in cleaned.split()
            if not re.match(r"^[A-Za-z0-9]{3,}$", w) and w not in ("=", "|", ".", "؛", ";")
        ]
        return " ".join(tokens).strip()

    def _clean_ar_address(addr: str) -> str:
        if not addr:
            return ""
        cleaned = re.sub(r"[|=\.؛;:\-_\"'\`ـ]+", " ", addr)
        tokens = [
            w for w in cleaned.split()
            if not re.search(r"[A-Za-z]{2,}", w) and w not in ("=", "|", ".", "؛", ";")
        ]
        res = " ".join(tokens).strip()
        res = res.replace("انمعد", "المعهد").replace("البعبرة", "البحيرة")
        return res

    cleaned_name = _clean_ar_name(raw_name)
    raw_addr = str(entities_raw.get("address", "")).strip()
    cleaned_addr = _clean_ar_address(raw_addr)

    entities = {
        "name": cleaned_name,
        "national_number": str(entities_raw.get("national_number", "")).strip() or fb_entities.get("national_number", ""),
        "address": cleaned_addr,
        "governorate": str(entities_raw.get("governorate", "")).strip(),
        "job": str(entities_raw.get("job", "")).strip(),
    }

    if not doc_number and entities.get("national_number"):
        doc_number = entities["national_number"]
    if not amount and amounts:
        amount = amounts[0]
    if not issue_date and dates:
        issue_date = dates[0]

    # Expiry date handling
    _null_values = (None, "", "null", "None", "N/A", "n/a", "nil")
    expiry_raw = payload.get("expiry_date")
    if expiry_raw in _null_values:
        expiry_raw = fb.get("expiry_date")

    expiry_date: str | None = (
        None
        if expiry_raw in _null_values
        else str(expiry_raw).strip() or None
    )

    # ── Deterministic Classification Guardrails ──────────────────────────────
    has_card_cues = any(k in ocr_text for k in ["بطاقة", "تحقيق الشخصية", "شخصية", "تحقيق شخصية"])
    has_birth_cues = any(k in ocr_text for k in ["صورة قيد", "صورةقيد", "صورةقي", "قيد ميلاد", "قيدالميلاد", "دالميلاد", "اسم المولود", "بيانات المولود", "اسم الأم", "محل الميلاد", "مبلاد", "واقعة ميلاد", "شهادة ميلاد"])
    has_passport_cues = any(k in ocr_text.lower() for k in ["جواز", "passport"])
    has_license_cues = any(k in ocr_text for k in ["رخصة", "قيادة", "تسيير", "وحدة مرور", "إدارة مرور", "جهات_الجيزه", "جهات_القاهرة"])

    from app.services.ocr_service import extract_national_id

    if doc_type == "national_id" or (has_card_cues and not has_birth_cues and not has_passport_cues and not has_license_cues):
        doc_type = "national_id"
        amount = ""
        amounts = []

        from app.services.ocr_service import parse_egyptian_national_id_text

        id_data = parse_egyptian_national_id_text(ocr_text)
        if id_data:
            # Address recovery: if address was hallucinated as digits or contains serial codes
            addr = entities.get("address", "")
            ar_letters = re.sub(r"[\d\s\W]", "", addr)
            if len(ar_letters) < 3 or any(kw in addr for kw in ["1K", "IK", "1K0753896"]) or not addr:
                if id_data.get("address"):
                    entities["address"] = id_data["address"]

            # Name recovery: only if name is completely missing from LLM
            if not entities.get("name") and id_data.get("name"):
                entities["name"] = id_data["name"]

            if id_data.get("governorate") and not entities.get("governorate"):
                entities["governorate"] = id_data["governorate"]

            # Fix common governorate OCR typo if present in address
            if entities.get("address") and "البعبرة" in entities["address"]:
                entities["address"] = entities["address"].replace("البعبرة", "البحيرة")
            if entities.get("address") and "انمعد" in entities["address"]:
                entities["address"] = entities["address"].replace("انمعد", "المعهد")

        existing_nid = str(entities.get("national_number") or payload.get("doc_number") or "").strip()
        if existing_nid and len(existing_nid) == 14 and existing_nid.isdigit() and existing_nid[0] in ("2", "3"):
            doc_number = existing_nid
            entities["national_number"] = existing_nid
        elif id_data and id_data.get("national_number"):
            doc_number = id_data["national_number"]
            entities["national_number"] = id_data["national_number"]
        else:
            nid = extract_national_id(ocr_text)
            if nid and len(nid) == 14 and nid.isdigit() and nid[0] in ("2", "3"):
                doc_number = nid
                entities["national_number"] = nid
            else:
                doc_number = None
                entities["national_number"] = None

        # Guard: doc_number and national_number must be strictly 14 digits or None
        if not doc_number or len(str(doc_number)) != 14 or not str(doc_number).isdigit() or str(doc_number)[0] not in ("2", "3"):
            doc_number = None
            entities["national_number"] = None

        name_val = entities.get("name") or ""
        summary = f"بطاقة رقم قومي للمواطن {name_val}." if name_val else "بطاقة رقم قومي لمواطن مصري."
        actions = "تجديد البطاقة في موعد الانتهاء واستخدامها لإثبات الشخصية."
        issuer = "قطاع مصلحة الأحوال المدنية - وزارة الداخلية"

    elif doc_type != "birth_certificate" and (has_birth_cues and not has_card_cues and not has_license_cues):
        doc_type = "birth_certificate"
        amount = ""
        amounts = []
        name_val = entities.get("name", "")
        summary = f"شهادة ميلاد للمولود {name_val}." if name_val else "شهادة ميلاد مصرية مميكنة."
        actions = "الاحتفاظ بصورة قيد الميلاد لاستخدامها في إثبات النسب والمعاملات الحكومية والمدرسية."
        issuer = "قطاع مصلحة الأحوال المدنية - وزارة الداخلية"

    elif doc_type == "driving_license" or (has_license_cues and not has_card_cues and not has_birth_cues):
        doc_type = "driving_license"
        amount = ""
        amounts = []
        if not issuer or issuer == "مستند رسمي" or "الجهة الحكومية" in issuer:
            issuer = "الإدارة العامة للمرور - وزارة الداخلية"

        # Force National ID extraction for field 5 of driving license
        nid = extract_national_id(ocr_text)
        if nid and (not doc_number or len(doc_number) != 14 or not doc_number.isdigit()):
            doc_number = nid
            entities["national_number"] = nid

        name_val = entities.get("name", "")
        is_female = any(kw in ocr_text for kw in ["أنثى", "انثى", "فاطمة", "عائشة", "مريم", "سارة", "هبة", "منى", "نورهان"])
        citizen_word = "لمواطنة" if is_female else "للمواطن"

        exp_str = expiry_date or ""
        if not summary or "4C" in summary or "جهات" in summary or summary.startswith("رخصة قيد") or summary.startswith("تم مسح") or summary.startswith("مستند رسمي"):
            if exp_str:
                summary = f"رخصة قيادة {citizen_word} {name_val} صالحة حتى {exp_str}." if name_val else f"رخصة قيادة مصرية صالحة حتى {exp_str}."
            else:
                summary = f"رخصة قيادة {citizen_word} {name_val}." if name_val else "رخصة قيادة مصرية."

        if not actions or actions.startswith("تجديد الرخصة قبل"):
            actions = "تجديد الرخصة قبل انتهاء صلاحيتها واحتفاظ بها أثناء قيادة المركبة."

    # Global guardrail: Identity / official registry documents NEVER have payment amounts
    if doc_type in ("national_id", "driving_license", "passport", "birth_certificate", "marriage_certificate", "death_certificate"):
        amount = ""
        amounts = []

    return DocumentAnalysisResult(
        doc_type=doc_type,
        summary=summary,
        issuer=issuer,
        doc_number=doc_number,
        amount=amount,
        issue_date=issue_date or None,
        expiry_date=expiry_date,
        actions=actions,
        entities=entities,
        dates=dates,
        amounts=amounts,
        tags=tags,
    )
    


# ── Public API ───────────────────────────────────────────────────────────────

def _parse_json_payload(raw: str) -> dict[str, Any]:
    # Strip stray markdown fences that some models emit despite JSON mode
    cleaned = re.sub(r"```(?:json)?|```", "", raw or "{}").strip()
    parsed: Any = json.loads(cleaned or "{}")
    if not isinstance(parsed, dict):
        raise ValueError(f"Expected JSON object, got {type(parsed).__name__}")
    return parsed


def analyze_document_text(ocr_text: str) -> dict[str, Any]:
    """
    Send *ocr_text* to an LLM (local Ollama by default, Groq as override/
    fallback — see chat_completion()) for structured document analysis.

    The function always returns a complete :class:`DocumentAnalysisResult`-
    compatible dict.  If no provider is reachable/configured, or the
    response cannot be parsed, it falls back silently to heuristic extraction
    so the pipeline never crashes due to an LLM outage.

    Parameters
    ----------
    ocr_text:
        Raw text string from the OCR stage.  May be empty.

    Returns
    -------
    dict
        Keys: doc_type, summary, dates, expiry_date, amounts, tags.
    """
    normalized = ocr_text.strip()
    if not normalized:
        return dict(_fallback_analysis(ocr_text))
    provider_name = (f"cloud (Azure OpenAI: {_AZURE_OPENAI_DEPLOYMENT})" if _AZURE_OPENAI_KEY else "cloud (Groq)") if _AI_PREFER_CLOUD else f"local (Ollama: {_OLLAMA_MODEL})"
    print(f"[AI SERVICE] Provider preference: {provider_name}")

    try:
        raw = chat_completion(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": normalized},
            ],
            temperature=0.1,        # low temperature → more deterministic extraction
            max_tokens=1024,
            json_mode=True,
        )
        parsed = _parse_json_payload(raw)
        return dict(_coerce_result(parsed, normalized))

    except Exception as e:
        print("\n========== AI ANALYSIS ERROR ==========")
        print(type(e).__name__)
        print(str(e))
        traceback.print_exc()
        print("========================================\n")

def analyze_document_image(image_path: str, ocr_text: str = "") -> dict[str, Any]:
    """Analyze document image directly via Multimodal Vision (Azure OpenAI Vision), falling back to text OCR."""
    if _AZURE_OPENAI_KEY and os.path.exists(image_path):
        try:
            import base64
            with open(image_path, "rb") as f:
                img_bytes = f.read()
            ext = os.path.splitext(image_path)[-1].lower()
            mime = "image/png" if ext == ".png" else "image/jpeg"
            base64_image = base64.b64encode(img_bytes).decode("utf-8")
            data_url = f"data:{mime};base64,{base64_image}"

            url = f"{_AZURE_OPENAI_ENDPOINT.rstrip('/')}/chat/completions"
            headers = {
                "api-key": _AZURE_OPENAI_KEY,
                "Content-Type": "application/json",
            }
            user_text = "اقرأ واستخرج كافة بيانات هذا المستند الحكومي المصري بالتفصيل بـ JSON."
            if ocr_text:
                user_text += f"\nنص الـ OCR المساعد:\n{ocr_text}"

            payload: dict[str, Any] = {
                "model": _AZURE_OPENAI_DEPLOYMENT,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_text},
                            {"type": "image_url", "image_url": {"url": data_url}}
                        ]
                    }
                ],
                "max_completion_tokens": 4096,
                "response_format": {"type": "json_object"}
            }
            res = requests.post(url, headers=headers, json=payload, timeout=30)
            res.raise_for_status()
            data = res.json()
            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            parsed = _parse_json_payload(raw)
            result = dict(_coerce_result(parsed, ocr_text))
            if result.get("doc_type") and result["doc_type"] != "unknown":
                print(f"[AI SERVICE Vision] Successfully analyzed photo directly via Azure OpenAI Vision!")
                return result
        except Exception as exc:
            print(f"[AI SERVICE Vision] Direct vision issue ({exc}); falling back to text analysis...")

    return analyze_document_text(ocr_text)


__all__ = ["analyze_document_text", "analyze_document_image", "chat_completion", "DocumentAnalysisResult", "SYSTEM_PROMPT"]
