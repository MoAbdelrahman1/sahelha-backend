from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Any

from app.config import DB_PATH, OFFICE_SEED, SERVICE_REQUIREMENTS_SEED, SERVICE_SEED, SERVICE_STEPS_SEED


@contextmanager
def db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
    finally:
        connection.close()


def table_count(connection: sqlite3.Connection, table_name: str) -> int:
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()
    return int(row["count"] if row else 0)


def seed_if_empty(connection: sqlite3.Connection) -> None:
    if table_count(connection, "service_categories") == 0:
        connection.executemany(
            """
            INSERT INTO service_categories (id, name_ar, icon_emoji, icon_url)
            VALUES (:id, :name_ar, :icon_emoji, :icon_url)
            """,
            SERVICE_SEED,
        )

    if table_count(connection, "service_requirements") == 0:
        rows: list[dict[str, Any]] = []
        for service_id, requirements in SERVICE_REQUIREMENTS_SEED.items():
            for order, requirement in enumerate(requirements, start=1):
                rows.append({"service_id": service_id, "item_order": order, "document_text_ar": requirement})
        connection.executemany(
            """
            INSERT INTO service_requirements (service_id, item_order, document_text_ar)
            VALUES (:service_id, :item_order, :document_text_ar)
            """,
            rows,
        )

    if table_count(connection, "service_steps") == 0:
        rows = []
        for service_id, steps in SERVICE_STEPS_SEED.items():
            for step in steps:
                rows.append({"service_id": service_id, **step})
        connection.executemany(
            """
            INSERT INTO service_steps (service_id, step_order, icon, text_ar, audio_url)
            VALUES (:service_id, :step_order, :icon, :text_ar, :audio_url)
            """,
            rows,
        )

    if table_count(connection, "offices") == 0:
        connection.executemany(
            """
            INSERT INTO offices (id, name_ar, address_ar, lat, lng, hours, phone)
            VALUES (:id, :name_ar, :address_ar, :lat, :lng, :hours, :phone)
            """,
            [
                {key: office[key] for key in ["id", "name_ar", "address_ar", "lat", "lng", "hours", "phone"]}
                for office in OFFICE_SEED
            ],
        )

    if table_count(connection, "office_services") == 0:
        rows = []
        for office in OFFICE_SEED:
            for service_id in office["service_ids"]:
                rows.append({"office_id": office["id"], "service_id": service_id})
        connection.executemany(
            """
            INSERT INTO office_services (office_id, service_id)
            VALUES (:office_id, :service_id)
            """,
            rows,
        )

    connection.commit()


def init_db(schema_sql: str) -> None:
    with db_connection() as connection:
        connection.executescript(schema_sql)
        seed_if_empty(connection)