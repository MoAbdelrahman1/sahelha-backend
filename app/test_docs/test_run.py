from __future__ import annotations

import json
import subprocess
import sys
import traceback
from pathlib import Path


def resolve_test_image_path() -> Path | None:
    script_dir = Path(__file__).resolve().parent
    candidates = [script_dir / "image.png", Path.cwd() / "app" / "test_docs" / "image.png"]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    supported_extensions = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
    for candidate in sorted(script_dir.iterdir()):
        if candidate.is_file() and candidate.suffix.lower() in supported_extensions:
            return candidate

    return None

def run_test():
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

    try:
        print(f"\nProcessing file: {test_image_path}")
        print("Running OCR + Groq in a subprocess so native-library crashes do not kill the checker...")

        child_script = (
            "from app.services.pipeline import process_document_pipeline; "
            "import json, sys; "
            "result = process_document_pipeline(sys.argv[1]); "
            "print(json.dumps(result, indent=2, ensure_ascii=False))"
        )
        completed = subprocess.run(
            [sys.executable, "-c", child_script, str(test_image_path)],
            capture_output=True,
            text=True,
        )

        print("\n" + "=" * 60)
        print(f"SUBPROCESS EXIT CODE: {completed.returncode}")
        print("=" * 60)
        if completed.stdout.strip():
            print("\nSUBPROCESS STDOUT:")
            print(completed.stdout)
        if completed.stderr.strip():
            print("\nSUBPROCESS STDERR:")
            print(completed.stderr)
        print("=" * 60)
        
    except Exception as e:
        print("\nPIPELINE CRASHED")
        print(f"Detailed Error Message: {e}")
        traceback.print_exc()
        print("=" * 60)

if __name__ == "__main__":
    run_test()