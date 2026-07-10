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

from dotenv import load_dotenv

try:
    from groq import Groq
except ImportError as exc:  # pragma: no cover
    Groq = None  # type: ignore[assignment]
    _GROQ_IMPORT_ERROR: Exception | None = exc
else:
    _GROQ_IMPORT_ERROR = None

load_dotenv()

# ── Model selection ──────────────────────────────────────────────────────────
# Override in .env: GROQ_MODEL=llama-3.3-70b-versatile for higher accuracy
_GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


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

Important correction rules:
- "محد" or "مهمد" should be corrected to "محمد" when context indicates a person name.
- Fix spacing and broken Arabic words.


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
    if any(m in text.lower() for m in markers):
        return dates[0] if dates else None
    return None


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
    expiry_raw = payload.get(
        "expiry_date",
        fb["expiry_date"]
    )

    _null_values = (
        None,
        "",
        "null",
        "None",
        "N/A",
        "n/a",
        "nil"
    )

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

def analyze_document_text(ocr_text: str) -> dict[str, Any]:
    """
    Send *ocr_text* to Groq (LLaMA) for structured document analysis.

    The function always returns a complete :class:`DocumentAnalysisResult`-
    compatible dict.  If the API key is missing, the request fails, or the
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

    try:
        client = _get_client()
        completion = client.chat.completions.create(
            model=_GROQ_MODEL,
            temperature=0.1,        # low temperature → more deterministic extraction
            max_tokens=1024,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": normalized},
            ],
        )

        raw: str = completion.choices[0].message.content or "{}"

        # Strip stray markdown fences that some models emit despite json_object mode
        raw = re.sub(r"```(?:json)?|```", "", raw).strip()

        parsed: Any = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError(f"Expected JSON object, got {type(parsed).__name__}")

        return dict(_coerce_result(parsed, normalized))

    except Exception as e:
    

        print("\n========== GROQ ERROR ==========")
        print(type(e).__name__)
        print(str(e))
        traceback.print_exc()
        print("================================\n")

    return dict(_fallback_analysis(normalized))


__all__ = ["analyze_document_text", "DocumentAnalysisResult", "SYSTEM_PROMPT"]