"""
app/test_docs/test_run.py
~~~~~~~~~~~~~~~~~~~~~~~~~
Standalone test runner for the Arabic document intelligence pipeline.
"""
from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

from app.services.pipeline import process_document_pipeline


def resolve_test_image_path() -> Path | None:
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir / "image.png",
        Path.cwd() / "app" / "test_docs" / "image.png",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    supported_extensions = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
    for candidate in sorted(script_dir.iterdir()):
        if candidate.is_file() and candidate.suffix.lower() in supported_extensions:
            return candidate

    return None


def run_test() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60)
    print("STARTING ARABIC DOCUMENT INTELLIGENCE PIPELINE TEST")
    print("=" * 60)

    test_image_path = resolve_test_image_path()
    if test_image_path is None:
        print("\nERROR: Test image missing!")
        print("Put a sample image in this folder or in app/test_docs/.")
        print("Supported formats: PNG, JPG, JPEG, WEBP, BMP, TIFF.")
        print("=" * 60)
        return

    print(f"\nProcessing file: {test_image_path}")

    try:
        result = process_document_pipeline(str(test_image_path))

        print("\n" + "=" * 60)
        print("PIPELINE RESULT")
        print("=" * 60)
        print(json.dumps(result, indent=2, ensure_ascii=False))

        print("\n" + "─" * 60)
        print("PARSED RESULT SUMMARY")
        print("─" * 60)
        print(f"  doc_type    : {result.get('doc_type', 'n/a')}")
        print(f"  summary     : {result.get('summary', 'n/a')}")
        print(f"  dates       : {result.get('dates', [])}")
        print(f"  expiry_date : {result.get('expiry_date')}")
        print(f"  amounts     : {result.get('amounts', [])}")
        print(f"  tags        : {result.get('tags', [])}")
        ocr_preview = (result.get("ocr_text") or "")[:200]
        print(f"  ocr_text    : {ocr_preview!r}")
        print("─" * 60)

        print("=" * 60)

    except Exception as exc:
        print("\nTEST RUNNER CRASHED")
        print(f"Error: {exc}")
        traceback.print_exc()
        print("=" * 60)


if __name__ == "__main__":
    run_test()