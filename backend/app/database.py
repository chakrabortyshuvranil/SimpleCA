import sqlite3
from contextlib import contextmanager

from .config import CHART_OF_ACCOUNTS, DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
    account_code TEXT NOT NULL REFERENCES accounts(code),
    side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
    amount REAL NOT NULL
);
"""


def _ensure_enabled_column(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
    if "enabled" not in columns:
        conn.execute("ALTER TABLE accounts ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        _ensure_enabled_column(conn)
        conn.executemany(
            "INSERT OR IGNORE INTO accounts (code, name, type) VALUES (?, ?, ?)",
            CHART_OF_ACCOUNTS,
        )
        conn.commit()


def list_all_accounts(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """All accounts, including disabled ones. Used only by the settings screen."""
    return conn.execute("SELECT code, name, type, enabled FROM accounts ORDER BY code").fetchall()


def set_enabled_accounts(conn: sqlite3.Connection, enabled_codes: set[str]) -> None:
    conn.execute("UPDATE accounts SET enabled = 0")
    if enabled_codes:
        conn.executemany(
            "UPDATE accounts SET enabled = 1 WHERE code = ?",
            [(code,) for code in enabled_codes],
        )
    conn.commit()


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
