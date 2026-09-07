from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user, now_iso
from app.db import db_connection
from app.schemas import ReminderCreate, ReminderResponse

router = APIRouter()


def _row_to_reminder(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "document_id": row["document_id"],
        "remind_at": row["remind_at"],
        "message": row["message"],
        "sent": bool(row["sent"]),
        "created_at": row["created_at"],
    }


@router.get("/", response_model=list[ReminderResponse])
def list_reminders(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC",
            (current_user["id"],),
        ).fetchall()
    return [_row_to_reminder(row) for row in rows]


@router.post("/", response_model=ReminderResponse)
def create_reminder(
    body: ReminderCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with db_connection() as connection:
        if body.document_id is not None:
            owned = connection.execute(
                "SELECT id FROM documents WHERE id = ? AND user_id = ?",
                (body.document_id, current_user["id"]),
            ).fetchone()
            if owned is None:
                raise HTTPException(status_code=404, detail="Document not found")

        cursor = connection.execute(
            """
            INSERT INTO reminders (user_id, document_id, remind_at, message, sent, created_at)
            VALUES (?, ?, ?, ?, 0, ?)
            """,
            (current_user["id"], body.document_id, body.remind_at.isoformat(), body.message, now_iso()),
        )
        connection.commit()

        row = connection.execute(
            "SELECT * FROM reminders WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return _row_to_reminder(row)


@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT id FROM reminders WHERE id = ? AND user_id = ?",
            (reminder_id, current_user["id"]),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Reminder not found")

        connection.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
        connection.commit()

    return {"message": "Deleted"}
