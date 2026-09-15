from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from app.core.security import get_current_user, get_upload_dir, now_iso
from app.core.storage import file_extension, save_upload_file
from app.db import db_connection
from app.schemas import DocumentUploadResponse, UserDocumentResponse
from app.services.pipeline import process_document_pipeline
from app.services.reminder_service import create_reminder_from_expiry

router = APIRouter()


def _row_to_document(row: sqlite3.Row) -> dict[str, Any]:
    image_path = row["image_path"] if "image_path" in row.keys() else None
    document_type = row["document_type"]
    
    entities = {}
    if "entities_json" in row.keys() and row["entities_json"]:
        try:
            entities = json.loads(row["entities_json"])
        except Exception:
            pass

    if not entities:
        try:
            with db_connection() as connection:
                f_rows = connection.execute(
                    "SELECT field_key, field_value FROM document_fields WHERE document_id = ?",
                    (row["id"],),
                ).fetchall()
                entities = {r["field_key"]: str(r["field_value"]) for r in f_rows}
        except Exception:
            pass

    ai_summary = row["ai_summary"] if ("ai_summary" in row.keys() and row["ai_summary"]) else (row["summary_arabic"] if "summary_arabic" in row.keys() else "")

    dates = []
    if "dates_json" in row.keys() and row["dates_json"]:
        try:
            dates = json.loads(row["dates_json"])
        except Exception:
            pass
    if not dates and entities.get("dates"):
        dates = [entities["dates"]]

    expiry_date = row["expiry_date"] if "expiry_date" in row.keys() else None
    if not expiry_date and entities.get("expiry_date"):
        expiry_date = entities["expiry_date"]

    amounts = []
    if "amounts_json" in row.keys() and row["amounts_json"]:
        try:
            amounts = json.loads(row["amounts_json"])
        except Exception:
            pass
    if not amounts and entities.get("amount"):
        amounts = [entities["amount"]]

    tags = []
    if "tags" in row.keys() and row["tags"]:
        try:
            tags = json.loads(row["tags"])
        except Exception:
            pass

    return {
        "id": row["id"],
        "status": row["status"] or "done",
        "doc_type": None if document_type in (None, "processing") else document_type,
        "ai_summary": ai_summary,
        "ocr_text": row["raw_text"],
        "entities": entities,
        "dates": dates,
        "amounts": amounts,
        "expiry_date": expiry_date,
        "tags": tags,
        "image_url": f"/{Path(image_path).as_posix()}" if image_path else None,
        "created_at": row["created_at"],
    }


def _run_pipeline_and_persist(doc_id: int, image_path: str, user_id: int) -> None:
    """Runs on FastAPI's background threadpool after the upload response is sent."""
    result = process_document_pipeline(image_path)
    ocr_text = result.get("ocr_text", "")
    status = "failed" if result.get("ocr_error") and not ocr_text else "done"

    from app.services.ai_service import _coerce_result

    coerced = _coerce_result(result, ocr_text)
    doc_type_val = coerced.get("doc_type", "unknown")
    summary_val = coerced.get("summary", "")
    entities_val = coerced.get("entities", {})
    doc_number_val = coerced.get("doc_number")
    if doc_number_val and len(str(doc_number_val)) == 14 and str(doc_number_val).isdigit():
        entities_val["doc_number"] = str(doc_number_val)
        entities_val["national_number"] = str(doc_number_val)

    with db_connection() as connection:
        connection.execute(
            """
            UPDATE documents
            SET document_type = ?, ai_summary = ?, raw_text = ?, tags = ?,
                dates_json = ?, amounts_json = ?, expiry_date = ?, status = ?,
                entities_json = ?
            WHERE id = ?
            """,
            (
                doc_type_val,
                summary_val,
                ocr_text,
                json.dumps(coerced.get("tags", [])),
                json.dumps(coerced.get("dates", [])),
                json.dumps([] if doc_type_val in ("national_id", "driving_license", "passport", "birth_certificate") else coerced.get("amounts", [])),
                coerced.get("expiry_date"),
                status,
                json.dumps(entities_val),
                doc_id,
            ),
        )
        
        # Populate document_fields table with extracted entities
        entities = result.get("entities", {})
        if isinstance(entities, dict) and entities:
            fields_to_insert = []
            for key, val in entities.items():
                if val:
                    label_ar = {
                        "name": "الاسم",
                        "address": "العنوان",
                        "governorate": "المحافظة"
                    }.get(key, key)
                    fields_to_insert.append((doc_id, key, label_ar, val))
            
            if fields_to_insert:
                connection.executemany(
                    """
                    INSERT INTO document_fields (document_id, field_key, field_label_ar, field_value)
                    VALUES (?, ?, ?, ?)
                    """,
                    fields_to_insert,
                )

        connection.commit()

    expiry_date = result.get("expiry_date")
    if expiry_date:
        create_reminder_from_expiry(doc_id, user_id, expiry_date)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    content = await file.read()
    ext = file_extension(file.filename or "") or ".jpg"
    relative_name = f"{current_user['id']}/{uuid4().hex}{ext}"
    image_path = save_upload_file(get_upload_dir(), relative_name, content)

    with db_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO documents
                (session_id, original_name, mime_type, document_type, summary_arabic,
                 raw_text, created_at, user_id, image_path, status)
            VALUES (?, ?, ?, 'processing', '', NULL, ?, ?, ?, 'processing')
            """,
            (None, file.filename, file.content_type, now_iso(), current_user["id"], image_path),
        )
        connection.commit()
        doc_id = int(cursor.lastrowid)

    background_tasks.add_task(_run_pipeline_and_persist, doc_id, image_path, current_user["id"])

    return {"doc_id": doc_id, "status": "processing", "message": "Document received, processing started"}


from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import _decode_jwt

optional_bearer = HTTPBearer(auto_error=False)


def get_optional_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer)) -> dict[str, Any] | None:
    if not credentials:
        return None
    try:
        payload = _decode_jwt(credentials.credentials)
        user_id = int(payload["sub"])
        with db_connection() as connection:
            row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row) if row else None
    except Exception:
        return None


@router.get("/", response_model=list[UserDocumentResponse])
def list_documents(current_user: dict[str, Any] | None = Depends(get_optional_current_user)) -> list[dict[str, Any]]:
    with db_connection() as connection:
        user_id = current_user["id"] if current_user else 1
        rows = connection.execute(
            "SELECT * FROM documents WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return [_row_to_document(row) for row in rows]


@router.get("/{doc_id}", response_model=UserDocumentResponse)
def get_document(doc_id: int, current_user: dict[str, Any] | None = Depends(get_optional_current_user)) -> dict[str, Any]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT * FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return _row_to_document(row)


@router.delete("/{doc_id}")
def delete_document(doc_id: int, current_user: dict[str, Any] | None = Depends(get_optional_current_user)) -> dict[str, str]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT image_path FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Document not found")

        connection.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        connection.commit()

    if row["image_path"]:
        Path(row["image_path"]).unlink(missing_ok=True)

    return {"message": "Deleted"}
