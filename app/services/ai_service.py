from __future__ import annotations

import json
import os
import re
from typing import Any, TypedDict

from dotenv import load_dotenv

try:
    from groq import Groq
except ImportError as exc:  # pragma: no cover - dependency is expected to be installed
    Groq = None  # type: ignore[assignment]
    _GROQ_IMPORT_ERROR = exc
else:
    _GROQ_IMPORT_ERROR = None


load_dotenv()


class DocumentAnalysisResult(TypedDict):
    doc_type: str
    summary: str
    dates: list[str]
    expiry_date: str | None
    amounts: list[str]
    tags: list[str]


SYSTEM_PROMPT = (
    "You are an expert assistant for Egyptian and Arabic administrative documents, receipts, "
    "applications, IDs, certificates, and payment records. Read OCR text with structural reasoning, "
    "repair minor OCR spelling or spacing mistakes when they are clearly implied by the document shape, "
    "and preserve important names, numbers, dates, and monetary values exactly when possible. "
    "Return only a single JSON object with these exact keys: "
    "doc_type, summary, dates, expiry_date, amounts, tags. "
    "doc_type must be a short lowercase label such as national_id, receipt, invoice, passport, "
    "birth_certificate, utility_bill, application_form, or unknown. summary must be concise Arabic or English. "
    "dates must be an array of detected dates as strings. expiry_date must be a string or null. "
    "amounts must be an array of detected amounts as strings. tags must be an array of short labels."
)

_CLIENT: Groq | None = None


def _get_client() -> Groq:
    global _CLIENT

    if Groq is None:
        raise RuntimeError("groq is not installed") from _GROQ_IMPORT_ERROR

    if _CLIENT is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set in the environment")
        _CLIENT = Groq(api_key=api_key)
    return _CLIENT


def _heuristic_doc_type(text: str) -> str:
    lowered = text.lower()
    if any(keyword in lowered for keyword in ["receipt", "إيصال", "مدفوع", "paid", "cash"]):
        return "receipt"
    if any(keyword in lowered for keyword in ["invoice", "فاتورة", "tax invoice"]):
        return "invoice"
    if any(keyword in lowered for keyword in ["passport", "جواز"]):
        return "passport"
    if any(
        keyword in lowered
        for keyword in [
            "national id",
            "national identity",
            "id card",
            "identity card",
            "card",
            "بطاقة",
            "البطاقة",
            "الرقم القومي",
            "رقم قومي",
            "الهوية",
        ]
    ):
        return "national_id"
    if any(keyword in lowered for keyword in ["birth", "ميلاد"]):
        return "birth_certificate"
    if any(keyword in lowered for keyword in ["utility", "electricity", "gas", "water", "مياه", "كهرباء", "غاز"]):
        return "utility_bill"
    return "unknown"


def _extract_dates(text: str) -> list[str]:
    pattern = re.compile(r"\b(?:\d{1,2}[\-/\.]){2}\d{2,4}\b|\b\d{4}[\-/\.](?:\d{1,2}[\-/\.])\d{1,2}\b")
    matches = pattern.findall(text)
    cleaned = [match.strip() for match in matches if match.strip()]
    return list(dict.fromkeys(cleaned))


def _extract_amounts(text: str) -> list[str]:
    pattern = re.compile(r"(?:EGP|ج\.م\.?|LE|£)?\s*\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?")
    matches = [match.strip() for match in pattern.findall(text)]
    normalized = [match for match in matches if any(char.isdigit() for char in match)]
    return list(dict.fromkeys(normalized))


def _extract_expiry_date(text: str, dates: list[str]) -> str | None:
    lowered = text.lower()
    expiry_markers = ["expiry", "expires", "valid until", "expires on", "انتهاء", "صلاحية", "تنتهي"]
    if any(marker in lowered for marker in expiry_markers):
        return dates[0] if dates else None
    return None


def _extract_tags(text: str, doc_type: str) -> list[str]:
    tags = {doc_type}
    lowered = text.lower()
    keyword_map = {
        "arabic": any(ord(char) > 127 for char in text),
        "receipt": any(keyword in lowered for keyword in ["receipt", "إيصال"]),
        "financial": any(keyword in lowered for keyword in ["invoice", "amount", "total", "price", "فاتورة", "إجمالي"]),
        "identity": any(keyword in lowered for keyword in ["national id", "card", "بطاقة", "passport", "جواز"]),
        "government": any(keyword in lowered for keyword in ["ministry", "government", "حكومة", "وزارة", "سجل"]),
    }

    for tag, enabled in keyword_map.items():
        if enabled:
            tags.add(tag)

    return sorted(tags)


def _fallback_analysis(ocr_text: str) -> DocumentAnalysisResult:
    doc_type = _heuristic_doc_type(ocr_text)
    dates = _extract_dates(ocr_text)
    amounts = _extract_amounts(ocr_text)
    expiry_date = _extract_expiry_date(ocr_text, dates)
    if not ocr_text.strip():
        summary = "No OCR text was extracted, so the document could not be classified."
    else:
        summary = "OCR text extracted successfully, but the LLM analysis was unavailable."
    if doc_type != "unknown":
        summary = f"Heuristic classification suggests this is a {doc_type.replace('_', ' ')} document."

    return {
        "doc_type": doc_type,
        "summary": summary,
        "dates": dates,
        "expiry_date": expiry_date,
        "amounts": amounts,
        "tags": _extract_tags(ocr_text, doc_type),
    }


def _coerce_analysis_payload(payload: dict[str, Any], ocr_text: str) -> DocumentAnalysisResult:
    fallback = _fallback_analysis(ocr_text)

    doc_type = str(payload.get("doc_type") or fallback["doc_type"]).strip() or fallback["doc_type"]
    summary = str(payload.get("summary") or fallback["summary"]).strip() or fallback["summary"]

    dates_value = payload.get("dates", fallback["dates"])
    dates = [str(item).strip() for item in dates_value] if isinstance(dates_value, list) else fallback["dates"]
    dates = [item for item in dates if item]

    expiry_value = payload.get("expiry_date", fallback["expiry_date"])
    expiry_date = None if expiry_value in (None, "", "null", "None") else str(expiry_value).strip()
    if expiry_date == "":
        expiry_date = None

    amounts_value = payload.get("amounts", fallback["amounts"])
    amounts = [str(item).strip() for item in amounts_value] if isinstance(amounts_value, list) else fallback["amounts"]
    amounts = [item for item in amounts if item]

    tags_value = payload.get("tags", fallback["tags"])
    tags = [str(item).strip() for item in tags_value] if isinstance(tags_value, list) else fallback["tags"]
    tags = [item for item in tags if item]

    if not dates:
        dates = fallback["dates"]
    if not amounts:
        amounts = fallback["amounts"]
    if not tags:
        tags = fallback["tags"]

    return {
        "doc_type": doc_type,
        "summary": summary,
        "dates": dates,
        "expiry_date": expiry_date,
        "amounts": amounts,
        "tags": tags,
    }


def analyze_document_text(ocr_text: str) -> dict[str, Any]:
    normalized_text = ocr_text.strip()
    if not normalized_text:
        return _fallback_analysis(ocr_text)

    try:
        client = _get_client()
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": normalized_text},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("Groq response was not a JSON object")
        return _coerce_analysis_payload(parsed, normalized_text)
    except Exception:
        return _fallback_analysis(normalized_text)


__all__ = ["analyze_document_text", "DocumentAnalysisResult", "SYSTEM_PROMPT"]
