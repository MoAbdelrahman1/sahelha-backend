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
    1. **OCR** — :func:`run_arabic_ocr` preprocesses the image (upscale,
       CLAHE, denoise, sharpen) and runs EasyOCR with detail=1 for accurate
       reading-order reconstruction.
    2. **LLM analysis** — :func:`analyze_document_text` sends the OCR text to
       Groq (LLaMA) and returns a structured dict.  Falls back to heuristics
       if the API is unavailable.

    The raw ``ocr_text`` is always embedded in the returned payload so callers
    can inspect what the OCR produced independently of the LLM classification.

    Parameters
    ----------
    image_path:
        Absolute or relative path to the source image.

    Returns
    -------
    dict with keys:
        • ``ocr_text``     — raw text from OCR stage (empty string on failure)
        • ``doc_type``     — e.g. "national_id", "receipt", "unknown"
        • ``summary``      — one-or-two-sentence description
        • ``dates``        — list of detected date strings
        • ``expiry_date``  — expiry / valid-until date or None
        • ``amounts``      — list of detected monetary amounts
        • ``tags``         — list of short descriptive labels
        • ``ocr_error``    — (only present) error message if OCR stage failed
        • ``analysis_error`` — (only present) error message if LLM stage failed
    """
    response: dict[str, Any] = {"ocr_text": ""}
    _DIVIDER = "─" * 60

    # ── Stage 1 : OCR ────────────────────────────────────────────────────────
    ocr_text = ""
    try:
        ocr_text = run_arabic_ocr(image_path)
        response["ocr_text"] = ocr_text

        _safe_print(f"\n{_DIVIDER}")
        _safe_print(
            f"[OCR]  {len(ocr_text):,} characters extracted"
            f"  ·  source: {image_path}"
        )
        _safe_print(_DIVIDER)

        if ocr_text.strip():
            # Show up to 500 chars so the terminal is not flooded
            preview = ocr_text[:500]
            if len(ocr_text) > 500:
                preview += "\n… (truncated)"
            _safe_print("[OCR TEXT PREVIEW]\n" + preview)
        else:
            _safe_print("[OCR]  No text was detected in the image.")

        _safe_print(_DIVIDER)

    except Exception as exc:
        response["ocr_error"] = str(exc)
        _safe_print(f"\n[OCR ERROR] {exc}")

    # ── Stage 2 : LLM analysis ───────────────────────────────────────────────
    try:
        analysis: dict[str, Any] = analyze_document_text(ocr_text)
        response.update(analysis)

        _safe_print("[LLM ANALYSIS]")
        _safe_print(f"  doc_type    : {analysis.get('doc_type', 'n/a')}")
        _safe_print(f"  summary     : {analysis.get('summary', 'n/a')}")
        _safe_print(f"  dates       : {analysis.get('dates', [])}")
        _safe_print(f"  expiry_date : {analysis.get('expiry_date')}")
        _safe_print(f"  amounts     : {analysis.get('amounts', [])}")
        _safe_print(f"  tags        : {analysis.get('tags', [])}")
        _safe_print(_DIVIDER + "\n")

    except Exception as exc:
        response["analysis_error"] = str(exc)
        response.update(
            {
                "doc_type": "unknown",
                "summary": (
                    "Document analysis failed before the LLM response "
                    "could be produced."
                ),
                "dates": [],
                "expiry_date": None,
                "amounts": [],
                "tags": ["analysis_error"],
            }
        )
        _safe_print(f"\n[ANALYSIS ERROR] {exc}")

    return response


__all__ = ["process_document_pipeline"]