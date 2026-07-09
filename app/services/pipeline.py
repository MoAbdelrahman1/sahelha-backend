from __future__ import annotations

from typing import Any

from app.services.ai_service import analyze_document_text
from app.services.ocr_service import run_arabic_ocr


def process_document_pipeline(image_path: str) -> dict[str, Any]:
    response: dict[str, Any] = {"ocr_text": ""}

    try:
        ocr_text = run_arabic_ocr(image_path)
        print(f"\n[OCR] Extracted {len(ocr_text)} characters.", flush=True)
        response["ocr_text"] = ocr_text
    except Exception as exc:
        response["ocr_error"] = str(exc)
        ocr_text = ""

    try:
        analysis = analyze_document_text(ocr_text)
        response.update(analysis)
    except Exception as exc:
        response["analysis_error"] = str(exc)
        response.update(
            {
                "doc_type": "unknown",
                "summary": "Document analysis failed before the LLM response could be produced.",
                "dates": [],
                "expiry_date": None,
                "amounts": [],
                "tags": ["analysis_error"],
            }
        )

    return response


__all__ = ["process_document_pipeline"]
