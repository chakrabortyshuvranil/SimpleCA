import sqlite3
from contextlib import contextmanager

from .config import ACCOUNT_TYPE_CODE_BLOCKS, CHART_OF_ACCOUNTS, DB_PATH

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

CREATE TABLE IF NOT EXISTS business_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    business_id TEXT NOT NULL,
    address TEXT NOT NULL,
    fy_start TEXT NOT NULL,
    fy_end TEXT NOT NULL
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


def get_business_profile(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT business_name, business_type, business_id, address, fy_start, fy_end "
        "FROM business_profile WHERE id = 1"
    ).fetchone()


def is_setup_complete(conn: sqlite3.Connection) -> bool:
    return get_business_profile(conn) is not None


def complete_onboarding(
    conn: sqlite3.Connection,
    business_name: str,
    business_type: str,
    business_id: str,
    address: str,
    fy_start: str,
    fy_end: str,
    enabled_codes: set[str],
) -> None:
    """Saves the business profile and finalizes which accounts are enabled.
    The existence of the business_profile row is what locks the Chart of
    Accounts going forward — see is_setup_complete().
    """
    conn.execute("UPDATE accounts SET enabled = 0")
    if enabled_codes:
        conn.executemany(
            "UPDATE accounts SET enabled = 1 WHERE code = ?",
            [(code,) for code in enabled_codes],
        )
    conn.execute(
        """
        INSERT INTO business_profile (id, business_name, business_type, business_id, address, fy_start, fy_end)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        """,
        (business_name, business_type, business_id, address, fy_start, fy_end),
    )
    conn.commit()


def next_account_code(conn: sqlite3.Connection, account_type: str) -> str:
    base, top = ACCOUNT_TYPE_CODE_BLOCKS[account_type]
    rows = conn.execute(
        "SELECT code FROM accounts WHERE CAST(code AS INTEGER) BETWEEN ? AND ?",
        (base, top),
    ).fetchall()
    existing = [int(r["code"]) for r in rows]
    next_code = max(existing, default=base - 100) + 100
    if next_code > top:
        raise ValueError(f"No codes remaining in the {account_type} range ({base}-{top})")
    return str(next_code)


def add_account(conn: sqlite3.Connection, name: str, account_type: str) -> str:
    """Inserts a new account, auto-assigning the next available code in its
    type's range. Returns the assigned code. Works whether or not the Chart
    of Accounts has been locked by onboarding — locking only prevents
    changing accounts that already existed at lock time.
    """
    code = next_account_code(conn, account_type)
    conn.execute(
        "INSERT INTO accounts (code, name, type, enabled) VALUES (?, ?, ?, 1)",
        (code, name, account_type),
    )
    conn.commit()
    return code


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
