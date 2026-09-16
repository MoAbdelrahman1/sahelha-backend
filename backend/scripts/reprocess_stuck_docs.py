"""One-off: reprocess documents stuck in status='processing' that already have
raw_text but never got an AI summary (they failed during the SSL cert outage
before pip-system-certs was installed). No image_path is stored for these
rows, so re-running OCR isn't possible — this re-runs only the AI
classification/summarization step against the raw_text already on file.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import db_connection
from app.services.ai_service import analyze_document_text

DOC_IDS = [25, 26, 27, 28, 29, 30, 31, 32]


def main() -> None:
    with db_connection() as connection:
        rows = connection.execute(
            f"SELECT id, raw_text FROM documents WHERE id IN ({','.join('?' * len(DOC_IDS))})",
            DOC_IDS,
        ).fetchall()

        for row in rows:
            doc_id, raw_text = row["id"], row["raw_text"]
            if not raw_text:
                print(f"[SKIP] doc {doc_id}: no raw_text to reprocess")
                continue

            result = analyze_document_text(raw_text)
            doc_type_val = result.get("doc_type", "unknown")
            entities_val = result.get("entities", {}) or {}

            connection.execute(
                """
                UPDATE documents
                SET document_type = ?, ai_summary = ?, tags = ?,
                    dates_json = ?, amounts_json = ?, expiry_date = ?, status = 'done',
                    entities_json = ?
                WHERE id = ?
                """,
                (
                    doc_type_val,
                    result.get("summary", ""),
                    json.dumps(result.get("tags", [])),
                    json.dumps(result.get("dates", [])),
                    json.dumps(result.get("amounts", [])),
                    result.get("expiry_date"),
                    json.dumps(entities_val),
                    doc_id,
                ),
            )
            print(f"[OK] doc {doc_id}: doc_type={doc_type_val} summary={result.get('summary', '')[:40]!r}")

        connection.commit()


if __name__ == "__main__":
    main()
