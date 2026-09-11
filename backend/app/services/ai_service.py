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

# ── Model selection ──────────────────────────────────────────────────────────
# Override in .env: GROQ_MODEL=llama-3.3-70b-versatile for higher accuracy
_GROQ_MODEL: str = os.getenv("GROQ_MODEL", "allam-2-7b")

# ── Local AI (Ollama) ────────────────────────────────────────────────────────
# A locally-run Ollama server is the DEFAULT provider for every AI call in
# this module (document analysis and, via chat_completion(), the AI
# assistant's Q&A) — documents are analyzed on this machine and never sent to
# a third party unless AI_PREFER_CLOUD=true, or the local server is
# unreachable, in which case Groq is used as the fallback (and the old
# regex-only heuristic below that, if Groq is also unavailable).
#
# Requires Ollama running locally (https://ollama.com) with the configured
# model pulled: `ollama pull <OLLAMA_MODEL>`. Arabic-capable model choices:
# "qwen2.5:7b" (default — good multilingual quality/speed balance),
# "aya-expanse:8b" (Cohere's Aya, tuned specifically for non-English
# languages including Arabic), "llama3.1:8b".
_OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
_OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
_OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "60"))
_AI_PREFER_CLOUD: bool = os.getenv("AI_PREFER_CLOUD", "false").strip().lower() in {"1", "true", "yes"}


# ── Output schema ────────────────────────────────────────────────────────────

class DocumentAnalysisResult(TypedDict):
    doc_type: str
    summary: str
    entities: dict[str, str]
    dates: list[str]
    expiry_date: str | None
    amounts: list[str]
    tags: list[str]


# ── System prompt ────────────────────────────────────────────────────────────
# Explicitly tells the model:
#   • what it is processing (Egyptian admin docs with OCR noise)
#   • how to handle OCR artefacts (silently correct them)
#   • the *exact* JSON schema and every allowed doc_type value
#   • never to wrap the response in markdown or add prose

SYSTEM_PROMPT = """\
You are an expert Arabic document analyst specialized in Egyptian government documents.

You receive noisy OCR text extracted from images. OCR may contain mistakes:
- missing Arabic letters
- wrong characters
- separated words
- incorrect spacing

Your job:
1. Understand the document, not blindly copy OCR.
2. Correct obvious OCR mistakes.
3. Extract accurate information.
4. Always answer in Arabic.

For Egyptian national IDs:
- The name may span multiple lines.
- Never remove name parts.
- Preserve all consecutive Arabic name tokens.
- The full name starts after "بطاقة تحقيق الشخصية" and ends before address fields.
For Egyptian national ID cards:
- The 14 digit national ID number is NOT a date.
- Ignore any digit sequence that represents the national number.
- Dates must have separators like / or - or explicit date labels.
- Never return the national ID as a date.

Important correction rules:
- "محد" or "مهمد" should be corrected to "محمد" when context indicates a person name.
- Fix spacing and broken Arabic words.

For expiry_date:
- If the document text contains an expiration, validity, or "valid until" date
  (e.g. "تاريخ الانتهاء", "صالحة حتى", "صلاحية", "expiry", "valid until"), extract
  that exact date into "expiry_date".
- Prefer the date printed next to the expiry/validity label over any other date
  in the document (e.g. issue date, birth date).
- Return the date in the same format it appears in the OCR text.
- Only use null if no expiration/validity date is present in the document at all.


Return ONLY valid JSON.

Schema:

{
  "doc_type": "national_id | passport | birth_certificate | utility_bill | receipt | invoice | unknown",

  "summary": "Arabic summary of the document",

  "entities": {
      "name": "",
      "address": "",
      "governorate": ""
  },

  "dates": [],

  "expiry_date": null,

  "amounts": [],

  "tags": []
}


Rules:
- summary MUST be Arabic only.
- Never include English words in summary.
- Extract person names and addresses when available.
- If a value is missing use empty string.
- tags must contain 3-7 useful Arabic/English labels.

OCR text:
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
) -> str:
    """Call a locally-running Ollama server's native chat API.
    Attempts configured _OLLAMA_MODEL first, and falls back to other pulled models if 404.
    """
    models_to_try = [_OLLAMA_MODEL, "hf.co/ibm-granite/granite-4.2-3b-GGUF:Q3_K_M", "qwen2.5:3b", "llama3.2:latest"]
    seen = set()
    unique_models = [m for m in models_to_try if m and not (m in seen or seen.add(m))]

    last_exc = None
    for model_name in unique_models:
        payload: dict[str, Any] = {
            "model": model_name,
            "messages": messages,
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
        except Exception as err:
            raise err

    if last_exc:
        raise last_exc
    raise RuntimeError("No available Ollama model could complete the request")


def chat_completion(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.1,
    max_tokens: int = 1024,
    json_mode: bool = False,
) -> str:
    """Run one chat completion, preferring the local Ollama model.

    Provider order: local Ollama (unless AI_PREFER_CLOUD=true) → Groq. Used
    by both document analysis (below) and the AI assistant's Q&A
    (app/services/ai_chat_service.py) so the "local by default, cloud as an
    explicit override" policy applies everywhere this app calls an LLM, not
    just document analysis.

    Raises if every configured path fails — callers that have their own
    non-LLM fallback (e.g. analyze_document_text's heuristic extraction)
    should catch that themselves; callers with no such fallback (the AI
    assistant) are meant to let it surface as a 500.
    """
    if not _AI_PREFER_CLOUD:
        try:
            return _ollama_chat_completion(
                messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode
            )
        except Exception as exc:
            print(f"[AI SERVICE] Local Ollama unavailable ({exc}); attempting fallback...")

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
        raise RuntimeError("AI Service unavailable: Local Ollama timed out and GROQ_API_KEY is not configured.") from exc


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
    (["birth", "ميلاد", "مواليد"], "birth_certificate"),
    (["property", "عقار", "ملكية", "شهادة ملكية"], "property_record"),
    (
        [
            "national id", "national identity", "id card", "identity card",
            "بطاقة", "البطاقة", "الرقم القومي", "رقم قومي", "الهوية الشخصية",
        ],
        "national_id",
    ),
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
    Pure-heuristic analysis used when the Groq API is unavailable or returns
    unparseable output.  Never raises; always returns a complete result.
    """
    doc_type = _heuristic_doc_type(ocr_text)
    dates = _extract_dates(ocr_text)
    amounts = _extract_amounts(ocr_text)
    expiry_date = _extract_expiry_date(ocr_text, dates)

    if not ocr_text.strip():
        summary = "No OCR text was extracted; the document could not be classified."
    elif doc_type != "unknown":
        summary = (
            f"Heuristic classification: this appears to be a "
            f"{doc_type.replace('_', ' ')} document."
        )
    else:
        summary = (
            "OCR text was extracted but automated LLM analysis was unavailable. "
            "Manual review is recommended."
        )

    return DocumentAnalysisResult(
        doc_type=doc_type,
        summary=summary,
        dates=dates,
        expiry_date=expiry_date,
        amounts=amounts,
        tags=_extract_tags(ocr_text, doc_type),
    )
def _coerce_result(payload: dict[str, Any], ocr_text: str) -> DocumentAnalysisResult:
    """
    Merge an LLM-returned payload with heuristic fallbacks field-by-field.

    Ensures:
    - required keys always exist
    - correct data types
    - missing LLM fields get fallback values
    - preserves extracted entities (name/address/etc.)
    """
    fb = _fallback_analysis(ocr_text)

    def _str_or(key: str, default: str) -> str:
        val = payload.get(key)
        return str(val).strip() if val else default

    def _list_or(key: str, default: list[str]) -> list[str]:
        val = payload.get(key)

        if isinstance(val, list):
            clean = [
                str(item).strip()
                for item in val
                if str(item).strip()
            ]
            return clean if clean else default

        return default

    # Basic fields
    doc_type = _str_or("doc_type", fb["doc_type"])
    summary = _str_or("summary", fb["summary"])

    dates = _list_or("dates", fb["dates"])
    amounts = _list_or("amounts", fb["amounts"])
    tags = _list_or("tags", fb["tags"])

    # Entities extracted by LLM
    entities_raw = payload.get("entities", {})

    if not isinstance(entities_raw, dict):
        entities_raw = {}

    entities = {
        "name": str(
            entities_raw.get("name", "")
        ).strip(),

        "address": str(
            entities_raw.get("address", "")
        ).strip(),

        "governorate": str(
            entities_raw.get("governorate", "")
        ).strip(),
    }

    # Expiry date handling
    _null_values = (
        None,
        "",
        "null",
        "None",
        "N/A",
        "n/a",
        "nil"
    )

    # payload.get(key, default) only falls back when the key is *missing* —
    # the LLM always includes "expiry_date": null explicitly, so that lookup
    # alone would never reach the heuristic fallback. Fall back explicitly
    # whenever the LLM's value is one of the null-ish values instead.
    expiry_raw = payload.get("expiry_date")
    if expiry_raw in _null_values:
        expiry_raw = fb["expiry_date"]

    expiry_date: str | None = (
        None
        if expiry_raw in _null_values
        else str(expiry_raw).strip() or None
    )

    return DocumentAnalysisResult(
        doc_type=doc_type,
        summary=summary,
        entities=entities,
        dates=dates,
        expiry_date=expiry_date,
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
    print(f"[AI SERVICE] OCR text length: {len(normalized)}")
    print(f"[AI SERVICE] Provider preference: {'cloud (Groq)' if _AI_PREFER_CLOUD else f'local (Ollama: {_OLLAMA_MODEL})'}")

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

    return dict(_fallback_analysis(normalized))


__all__ = ["analyze_document_text", "chat_completion", "DocumentAnalysisResult", "SYSTEM_PROMPT"]
