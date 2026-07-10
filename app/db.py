from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Any

from app.config import DB_PATH, OFFICE_SEED, SERVICE_REQUIREMENTS_SEED, SERVICE_SEED, SERVICE_STEPS_SEED

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    fcm_token TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_message_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    audio_url TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    original_name TEXT,
    mime_type TEXT,
    document_type TEXT NOT NULL,
    summary_arabic TEXT NOT NULL,
    raw_text TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    field_key TEXT NOT NULL,
    field_label_ar TEXT NOT NULL,
    field_value TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audio_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    text_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    language TEXT NOT NULL,
    content_type TEXT NOT NULL,
    audio_blob BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY,
    name_ar TEXT NOT NULL,
    icon_emoji TEXT NOT NULL,
    icon_url TEXT
);

CREATE TABLE IF NOT EXISTS service_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    item_order INTEGER NOT NULL,
    document_text_ar TEXT NOT NULL,
    FOREIGN KEY (service_id) REFERENCES service_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    icon TEXT NOT NULL,
    text_ar TEXT NOT NULL,
    audio_url TEXT,
    FOREIGN KEY (service_id) REFERENCES service_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY,
    name_ar TEXT NOT NULL,
    address_ar TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    hours TEXT NOT NULL,
    phone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS office_services (
    office_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    PRIMARY KEY (office_id, service_id),
    FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES service_categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_request_cache (
    cache_key TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

# Columns added after the original `documents` table shipped. SQLite's
# CREATE TABLE IF NOT EXISTS is a no-op on an existing table, so these are
# applied as an idempotent ALTER TABLE migration on every startup.
DOCUMENT_COLUMN_MIGRATIONS: list[tuple[str, str]] = [
    ("user_id", "INTEGER REFERENCES users(id)"),
    ("image_path", "TEXT"),
    ("status", "TEXT NOT NULL DEFAULT 'processing'"),
    ("ai_summary", "TEXT"),
    ("tags", "TEXT"),
    ("dates_json", "TEXT"),
    ("amounts_json", "TEXT"),
    ("expiry_date", "TEXT"),
    ("entities_json", "TEXT"),
]



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


def ensure_column(connection: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    existing = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in existing:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def migrate_documents_table(connection: sqlite3.Connection) -> None:
    for column, ddl in DOCUMENT_COLUMN_MIGRATIONS:
        ensure_column(connection, "documents", column, ddl)
    connection.commit()


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
        migrate_documents_table(connection)
        seed_if_empty(connection)