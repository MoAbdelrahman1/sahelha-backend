from __future__ import annotations

import logging
import sqlite3
from datetime import datetime

import requests

from app.config import FCM_SERVER_KEY
from app.core.security import now_iso
from app.db import db_connection

logger = logging.getLogger("reminders")

FCM_SEND_URL = "https://fcm.googleapis.com/fcm/send"

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%m/%Y",
    "%Y/%m/%d",
)


def parse_expiry_date(expiry_date: str) -> datetime | None:
    try:
        return datetime.fromisoformat(expiry_date)
    except ValueError:
        pass

    for date_format in _DATE_FORMATS:
        try:
            return datetime.strptime(expiry_date, date_format)
        except ValueError:
            continue

    return None


def send_push_notification(fcm_token: str, title: str, body: str) -> bool:
    if not FCM_SERVER_KEY:
        logger.info("FCM_SERVER_KEY not configured, skipping push notification")
        return False

    try:
        response = requests.post(
            FCM_SEND_URL,
            headers={
                "Authorization": f"key={FCM_SERVER_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "to": fcm_token,
                "notification": {"title": title, "body": body},
            },
            timeout=10,
        )
        response.raise_for_status()
        return True
    except requests.RequestException as exc:
        logger.warning("FCM push failed: %s", exc)
        return False


def create_reminder_from_expiry(doc_id: int, user_id: int, expiry_date: str) -> None:
    """Schedules a reminder once the document pipeline extracts an expiry date."""
    remind_at = parse_expiry_date(expiry_date)
    if remind_at is None:
        return

    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO reminders (user_id, document_id, remind_at, message, sent, created_at)
            VALUES (?, ?, ?, ?, 0, ?)
            """,
            (user_id, doc_id, remind_at.isoformat(), f"مستندك ينتهي في {expiry_date}", now_iso()),
        )
        connection.commit()


def send_due_reminders() -> int:
    """Sends push notifications for reminders that are due and unsent.

    Intended to be called on a fixed interval by the scheduler in
    app/services/scheduler.py.
    """
    logger.info("Checking reminders...")
    now = datetime.utcnow().isoformat()

    with db_connection() as connection:
        rows: list[sqlite3.Row] = connection.execute(
            """
            SELECT reminders.id AS reminder_id, reminders.message AS message,
                   users.fcm_token AS fcm_token
            FROM reminders
            JOIN users ON users.id = reminders.user_id
            WHERE reminders.remind_at <= ? AND reminders.sent = 0
            """,
            (now,),
        ).fetchall()

        sent_count = 0
        for row in rows:
            fcm_token = row["fcm_token"]
            if fcm_token:
                sent_count += int(
                    send_push_notification(
                        fcm_token,
                        title="تذكير مستند",
                        body=row["message"] or "لديك مستند يحتاج انتباهك",
                    )
                )

            connection.execute(
                "UPDATE reminders SET sent = 1 WHERE id = ?",
                (row["reminder_id"],),
            )

        connection.commit()

    return sent_count
