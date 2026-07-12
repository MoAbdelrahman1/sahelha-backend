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
    image_path = row["image_path"]
    document_type = row["document_type"]
    return {
        "id": row["id"],
        "status": row["status"] or "processing",
        "doc_type": None if document_type in (None, "processing") else document_type,
        "ai_summary": row["ai_summary"],
        "ocr_text": row["raw_text"],
        "dates": json.loads(row["dates_json"]) if row["dates_json"] else [],
        "amounts": json.loads(row["amounts_json"]) if row["amounts_json"] else [],
        "expiry_date": row["expiry_date"],
        "tags": json.loads(row["tags"]) if row["tags"] else [],
        "image_url": f"/{Path(image_path).as_posix()}" if image_path else None,
        "created_at": row["created_at"],
    }


def _run_pipeline_and_persist(doc_id: int, image_path: str, user_id: int) -> None:
    """Runs on FastAPI's background threadpool after the upload response is sent.

    Calls the AI engineer's OCR + Groq pipeline (app/services/pipeline.py) and writes
    the results back onto the document row. Errors are captured into status='failed'
    rather than raised, since there's no request left to return them to.
    """
    result = process_document_pipeline(image_path)
    ocr_text = result.get("ocr_text", "")
    status = "failed" if result.get("ocr_error") and not ocr_text else "done"

    with db_connection() as connection:
        connection.execute(
            """
            UPDATE documents
            SET document_type = ?, ai_summary = ?, raw_text = ?, tags = ?,
                dates_json = ?, amounts_json = ?, expiry_date = ?, status = ?
            WHERE id = ?
            """,
            (
                result.get("doc_type", "unknown"),
                result.get("summary"),
                ocr_text,
                json.dumps(result.get("tags", [])),
                json.dumps(result.get("dates", [])),
                json.dumps(result.get("amounts", [])),
                result.get("expiry_date"),
                status,
                doc_id,
            ),
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


@router.get("/", response_model=list[UserDocumentResponse])
def list_documents(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC",
            (current_user["id"],),
        ).fetchall()
    return [_row_to_document(row) for row in rows]


@router.get("/{doc_id}", response_model=UserDocumentResponse)
def get_document(doc_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT * FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, current_user["id"]),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return _row_to_document(row)


@router.delete("/{doc_id}")
def delete_document(doc_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT image_path FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, current_user["id"]),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Document not found")

        connection.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        connection.commit()

    if row["image_path"]:
        Path(row["image_path"]).unlink(missing_ok=True)

    return {"message": "Deleted"}
