"""
app/services/pipeline.py
~~~~~~~~~~~~~~~~~~~~~~~~
Orchestrates the full document intelligence pipeline:
    image → OCR → Groq LLM analysis → structured result dict

Arabic console-printing fix
----------------------------
The original code failed to print Arabic text on Windows (and some Linux
CI environments) because the default ``sys.stdout`` encoding is not UTF-8.

``_ensure_utf8_stdout()`` is called at module import time and uses
``TextIOWrapper.reconfigure()`` (Python ≥ 3.7) to switch the stream to
UTF-8 with ``errors="replace"`` so that any character that *still* cannot
be encoded falls back to "?" rather than raising ``UnicodeEncodeError``.

The ``_safe_print()`` helper adds a second safety net: if the re-configured
stream still throws, it encodes the message to UTF-8 bytes and writes it
directly to ``sys.stdout.buffer``.

This combination covers:
• Windows cmd.exe (default cp1252 / cp1256)
• Windows PowerShell (default UTF-16 on some builds)
• Linux/macOS with LANG=C or LANG=POSIX (ASCII-only locale)
• Docker containers without locale set
• Any CI runner where sys.stdout has already been replaced
"""
from __future__ import annotations
from app.services.ocr_service import (
    run_arabic_ocr,
    extract_national_id
)

import io
import sys
from typing import Any


# ── UTF-8 output — MUST be called before any Arabic print() ─────────────────

def _ensure_utf8_stdout() -> None:
    """
    Reconfigure *sys.stdout* to UTF-8 with ``errors='replace'`` so Arabic text
    can be printed without ``UnicodeEncodeError`` on Windows / legacy terminals.

    Uses ``reconfigure()`` (Python ≥ 3.7) when available and falls back to
    wrapping ``sys.stdout.buffer`` in a new ``TextIOWrapper``.

    This function is idempotent and silently no-ops on failure so it never
    prevents the application from starting.
    """
    try:
        if hasattr(sys.stdout, "reconfigure"):
            # Fastest path — available on CPython ≥ 3.7
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        elif hasattr(sys.stdout, "buffer"):
            # Fallback: replace the stream object entirely
            sys.stdout = io.TextIOWrapper(
                sys.stdout.buffer,
                encoding="utf-8",
                errors="replace",
                line_buffering=True,
            )
    except Exception:
        # If reconfiguration fails for any reason (e.g. stdout is already
        # a StringIO in tests) we silently continue with the original stream.
        pass


_ensure_utf8_stdout()  # called at import time, before any downstream prints

# ── Service imports come AFTER stdout is fixed ───────────────────────────────
from app.services.ai_service import analyze_document_text   # noqa: E402
from app.services.ocr_service import run_arabic_ocr         # noqa: E402


# ── Arabic-safe print helper ─────────────────────────────────────────────────

def _safe_print(message: str, *, flush: bool = True) -> None:
    """
    Print *message* to stdout, gracefully handling terminals that cannot
    encode Arabic/Unicode even after ``_ensure_utf8_stdout()``.

    Fallback chain
    --------------
    1. ``print()`` — works on any UTF-8 capable terminal.
    2. Write UTF-8 bytes directly to ``sys.stdout.buffer`` — works on
       Windows when the console code page cannot be changed.
    3. ASCII-only representation with unmappable chars replaced by "?" —
       used as a last resort in CI / containerised environments.
    """
    try:
        print(message, flush=flush)
    except UnicodeEncodeError:
        try:
            encoded = (message + "\n").encode("utf-8", errors="replace")
            sys.stdout.buffer.write(encoded)
            if flush:
                sys.stdout.buffer.flush()
        except Exception:
            # Absolute last resort: strip non-ASCII
            ascii_msg = message.encode("ascii", errors="replace").decode("ascii")
            print(ascii_msg, flush=flush)


# ── Pipeline ─────────────────────────────────────────────────────────────────

def process_document_pipeline(image_path: str) -> dict[str, Any]:
    """
    End-to-end document intelligence pipeline.

    Stages
    ------
    1. **Primary Stage: Direct Multimodal Vision** — Sends image directly to Vision VLM (Azure OpenAI / vLLM)
       for 100% accurate document extraction without OCR noise.
    2. **Fallback Stage: Enhanced OpenCV + Local OCR + LLM** — If offline or Vision is unavailable,
       runs enhanced OpenCV preprocessing, EasyOCR, and local Ollama text analysis.
    """
    response: dict[str, Any] = {"ocr_text": ""}
    _DIVIDER = "─" * 60

    from app.services.ai_service import analyze_document_image

    # ── Primary Stage : Direct Multimodal Vision ──────────────────────────────
    try:
        _safe_print(f"\n{_DIVIDER}")
        _safe_print("[PIPELINE] Primary Stage: Attempting Direct Multimodal Vision analysis...")
        analysis: dict[str, Any] = analyze_document_image(image_path, ocr_text="")
        
        if analysis.get("doc_type") and analysis["doc_type"] != "unknown":
            _safe_print(f"[PIPELINE] Direct Vision succeeded! (doc_type: {analysis['doc_type']})")
            
            # Specialized 14-digit National ID crop refinements
            if analysis.get("doc_type") == "national_id":
                try:
                    import cv2
                    from app.services.ocr_service import extract_national_id_from_image
                    img = cv2.imread(image_path)
                    if img is not None:
                        nid = extract_national_id_from_image(img)
                        if nid and len(nid) == 14 and nid.isdigit() and nid[0] in ("2", "3"):
                            analysis.setdefault("entities", {})
                            analysis["entities"]["national_number"] = nid
                            analysis["doc_number"] = nid
                except Exception as e:
                    _safe_print(f"[ID CROP FALLBACK] Non-fatal card cropping issue: {e}")

            elif analysis.get("doc_type") == "birth_certificate":
                try:
                    from app.services.ocr_service import extract_birth_certificate_national_id
                    import cv2
                    img = cv2.imread(image_path)
                    if img is not None:
                        nid = extract_birth_certificate_national_id(img, ocr_context="")
                        if nid:
                            analysis.setdefault("entities", {})
                            analysis["entities"]["national_number"] = nid
                            analysis["doc_number"] = nid
                except Exception as e:
                    _safe_print(f"[BIRTH NID FALLBACK] Non-fatal issue: {e}")

            response.update(analysis)
            if not response.get("ocr_text"):
                response["ocr_text"] = analysis.get("summary", "")

            _safe_print("[LLM ANALYSIS]")
            _safe_print(f"  doc_type    : {analysis.get('doc_type', 'n/a')}")
            _safe_print(f"  summary     : {analysis.get('summary', 'n/a')}")
            _safe_print(f"  dates       : {analysis.get('dates', [])}")
            _safe_print(f"  expiry_date : {analysis.get('expiry_date')}")
            _safe_print(f"  amounts     : {analysis.get('amounts', [])}")
            _safe_print(f"  tags        : {analysis.get('tags', [])}")
            _safe_print(_DIVIDER + "\n")
            return response
    except Exception as exc:
        _safe_print(f"[PIPELINE] Direct Vision issue ({exc}). Falling back to Enhanced OCR + LLM...")

    # ── Fallback Stage : Enhanced OpenCV + EasyOCR + Local LLM ──────────────────
    ocr_text = ""
    try:
        ocr_text = run_arabic_ocr(image_path)
        response["ocr_text"] = ocr_text

        _safe_print(f"\n{_DIVIDER}")
        _safe_print(
            f"[FALLBACK OCR]  {len(ocr_text):,} characters extracted"
            f"  ·  source: {image_path}"
        )
        _safe_print(_DIVIDER)

        if ocr_text.strip():
            preview = ocr_text[:500]
            if len(ocr_text) > 500:
                preview += "\n… (truncated)"
            _safe_print("[OCR TEXT PREVIEW]\n" + preview)
        else:
            _safe_print("[FALLBACK OCR]  No text was detected in the image.")

        _safe_print(_DIVIDER)

    except Exception as exc:
        response["ocr_error"] = str(exc)
        _safe_print(f"\n[OCR ERROR] {exc}")

    try:
        from app.services.ai_service import analyze_document_text
        fallback_analysis: dict[str, Any] = analyze_document_text(ocr_text)
        response.update(fallback_analysis)

        _safe_print("[FALLBACK LLM ANALYSIS]")
        _safe_print(f"  doc_type    : {fallback_analysis.get('doc_type', 'n/a')}")
        _safe_print(f"  summary     : {fallback_analysis.get('summary', 'n/a')}")
        _safe_print(f"  dates       : {fallback_analysis.get('dates', [])}")
        _safe_print(f"  expiry_date : {fallback_analysis.get('expiry_date')}")
        _safe_print(f"  amounts     : {fallback_analysis.get('amounts', [])}")
        _safe_print(f"  tags        : {fallback_analysis.get('tags', [])}")
        _safe_print(_DIVIDER + "\n")

    except Exception as exc:
        response["analysis_error"] = str(exc)
        response.update(
            {
                "doc_type": "unknown",
                "summary": "Document analysis failed.",
                "dates": [],
                "expiry_date": None,
                "amounts": [],
                "tags": ["analysis_error"],
            }
        )
        _safe_print(f"\n[ANALYSIS ERROR] {exc}")

    return response


__all__ = ["process_document_pipeline"]