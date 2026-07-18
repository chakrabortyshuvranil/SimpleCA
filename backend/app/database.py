import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.rows import dict_row

from .config import ACCOUNT_TYPE_CODE_BLOCKS, CHART_OF_ACCOUNTS, DATABASE_URL

SESSION_LIFETIME = timedelta(days=30)

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS accounts (
        user_id INTEGER NOT NULL REFERENCES users(id),
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (user_id, code)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        date TEXT NOT NULL,
        description TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_lines (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
        user_id INTEGER NOT NULL,
        account_code TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
        amount REAL NOT NULL,
        FOREIGN KEY (user_id, account_code) REFERENCES accounts(user_id, code)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS business_profile (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
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
        conn.commit()
    finally:
        raw_conn.close()


def create_user(conn: Connection, email: str, password_hash: str) -> int:
    row = conn.execute(
        "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
        (email, password_hash),
    ).fetchone()
    user_id = row["id"]
    conn.executemany(
        "INSERT INTO accounts (user_id, code, name, type) VALUES (?, ?, ?, ?)",
        [(user_id, code, name, type_) for code, name, type_ in CHART_OF_ACCOUNTS],
    )
    conn.commit()
    return user_id


def get_user_by_email(conn: Connection, email: str):
    return conn.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?", (email,)
    ).fetchone()


def create_session(conn: Connection, user_id: int) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + SESSION_LIFETIME
    conn.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at),
    )
    conn.commit()
    return token, expires_at


def get_user_by_session_token(conn: Connection, token: str):
    return conn.execute(
        """
        SELECT users.id AS id, users.email AS email
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ? AND sessions.expires_at > now()
        """,
        (token,),
    ).fetchone()


def delete_session(conn: Connection, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()


def list_all_accounts(conn: Connection, user_id: int) -> list:
    """All of a user's accounts, including disabled ones. Used only by the settings screen."""
    return conn.execute(
        "SELECT code, name, type, enabled FROM accounts WHERE user_id = ? ORDER BY code",
        (user_id,),
    ).fetchall()


def get_business_profile(conn: Connection, user_id: int):
    return conn.execute(
        "SELECT business_name, business_type, business_id, address, fy_start, fy_end "
        "FROM business_profile WHERE user_id = ?",
        (user_id,),
    ).fetchone()


def is_setup_complete(conn: Connection, user_id: int) -> bool:
    return get_business_profile(conn, user_id) is not None


def complete_onboarding(
    conn: Connection,
    user_id: int,
    business_name: str,
    business_type: str,
    business_id: str,
    address: str,
    fy_start: str,
    fy_end: str,
    enabled_codes: set[str],
) -> None:
    """Saves the business profile and finalizes which accounts are enabled.
    The existence of the business_profile row is what locks this user's
    Chart of Accounts going forward — see is_setup_complete().
    """
    conn.execute("UPDATE accounts SET enabled = FALSE WHERE user_id = ?", (user_id,))
    if enabled_codes:
        conn.executemany(
            "UPDATE accounts SET enabled = TRUE WHERE user_id = ? AND code = ?",
            [(user_id, code) for code in enabled_codes],
        )
    conn.execute(
        """
        INSERT INTO business_profile (user_id, business_name, business_type, business_id, address, fy_start, fy_end)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, business_name, business_type, business_id, address, fy_start, fy_end),
    )
    conn.commit()


def next_account_code(conn: Connection, user_id: int, account_type: str) -> str:
    base, top = ACCOUNT_TYPE_CODE_BLOCKS[account_type]
    rows = conn.execute(
        "SELECT code FROM accounts WHERE user_id = ? AND CAST(code AS INTEGER) BETWEEN ? AND ?",
        (user_id, base, top),
    ).fetchall()
    existing = [int(r["code"]) for r in rows]
    next_code = max(existing, default=base - 100) + 100
    if next_code > top:
        raise ValueError(f"No codes remaining in the {account_type} range ({base}-{top})")
    return str(next_code)


def add_account(conn: Connection, user_id: int, name: str, account_type: str) -> str:
    """Inserts a new account for this user, auto-assigning the next available
    code in its type's range. Returns the assigned code. Works whether or not
    the Chart of Accounts has been locked by onboarding — locking only
    prevents changing accounts that already existed at lock time.
    """
    code = next_account_code(conn, user_id, account_type)
    conn.execute(
        "INSERT INTO accounts (user_id, code, name, type, enabled) VALUES (?, ?, ?, ?, ?)",
        (user_id, code, name, account_type, True),
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
