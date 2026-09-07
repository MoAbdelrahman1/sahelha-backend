from __future__ import annotations

import logging
import threading

from app.config import REMINDER_CHECK_INTERVAL_SECONDS
from app.services.reminder_service import send_due_reminders

logger = logging.getLogger("reminders")

_started = False
_stop_event = threading.Event()


def _run_loop() -> None:
    while not _stop_event.wait(REMINDER_CHECK_INTERVAL_SECONDS):
        try:
            send_due_reminders()
        except Exception:
            logger.exception("Reminder check failed")


def start_reminder_scheduler() -> None:
    """Starts a daemon thread that checks for due reminders on a fixed interval.

    Runs in-process instead of via APScheduler, which isn't installable in
    this environment (no network access to PyPI); the loop is functionally
    equivalent for a single-worker deployment.
    """
    global _started
    if _started:
        return
    _started = True

    thread = threading.Thread(target=_run_loop, name="reminder-scheduler", daemon=True)
    thread.start()
    logger.info("Reminder scheduler started (interval=%ss)", REMINDER_CHECK_INTERVAL_SECONDS)
