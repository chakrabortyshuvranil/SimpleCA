from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from .config import ACCOUNT_TYPE_CODE_BLOCKS, CHART_OF_ACCOUNTS, DATABASE_URL

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS accounts (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_lines (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
        account_code TEXT NOT NULL REFERENCES accounts(code),
        side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
        amount REAL NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS business_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        business_name TEXT NOT NULL,
        business_type TEXT NOT NULL,
        business_id TEXT NOT NULL,
        address TEXT NOT NULL,
        fy_start TEXT NOT NULL,
        fy_end TEXT NOT NULL
    )
    """,
]


class Connection:
    """Thin adapter so callers can keep using sqlite-style `?` placeholders
    and dict-like row access (row["col"]) against a psycopg3 connection.
    """

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def execute(self, sql: str, params=()) -> psycopg.Cursor:
        return self._conn.execute(sql.replace("?", "%s"), params)

    def executemany(self, sql: str, param_seq) -> None:
        cur = self._conn.cursor()
        cur.executemany(sql.replace("?", "%s"), list(param_seq))

    def commit(self) -> None:
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()


def init_db() -> None:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")

    raw_conn = psycopg.connect(DATABASE_URL)
    try:
        conn = Connection(raw_conn)
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
        conn.executemany(
            """
            INSERT INTO accounts (code, name, type) VALUES (?, ?, ?)
            ON CONFLICT (code) DO NOTHING
            """,
            CHART_OF_ACCOUNTS,
        )
        conn.commit()
    finally:
        raw_conn.close()


def list_all_accounts(conn: Connection) -> list:
    """All accounts, including disabled ones. Used only by the settings screen."""
    return conn.execute("SELECT code, name, type, enabled FROM accounts ORDER BY code").fetchall()


def get_business_profile(conn: Connection):
    return conn.execute(
        "SELECT business_name, business_type, business_id, address, fy_start, fy_end "
        "FROM business_profile WHERE id = 1"
    ).fetchone()


def is_setup_complete(conn: Connection) -> bool:
    return get_business_profile(conn) is not None


def complete_onboarding(
    conn: Connection,
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
    conn.execute("UPDATE accounts SET enabled = FALSE")
    if enabled_codes:
        conn.executemany(
            "UPDATE accounts SET enabled = TRUE WHERE code = ?",
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


def next_account_code(conn: Connection, account_type: str) -> str:
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


def add_account(conn: Connection, name: str, account_type: str) -> str:
    """Inserts a new account, auto-assigning the next available code in its
    type's range. Returns the assigned code. Works whether or not the Chart
    of Accounts has been locked by onboarding — locking only prevents
    changing accounts that already existed at lock time.
    """
    code = next_account_code(conn, account_type)
    conn.execute(
        "INSERT INTO accounts (code, name, type, enabled) VALUES (?, ?, ?, ?)",
        (code, name, account_type, True),
    )
    conn.commit()
    return code


@contextmanager
def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")

    raw_conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    conn = Connection(raw_conn)
    try:
        yield conn
    finally:
        conn.close()
