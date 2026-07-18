from .config import DEBIT_NORMAL_TYPES
from .database import Connection
from .schemas import (
    BalanceSheet,
    ChartAccount,
    GeneralLedgerAccount,
    JournalEntry,
    JournalEntryInput,
    JournalLine,
    LedgerPosting,
    ProfitLoss,
)


def compute_balance(conn: Connection, user_id: int, account_code: str, account_type: str) -> float:
    row = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN side = 'debit' THEN amount ELSE 0 END), 0) AS debit_total,
            COALESCE(SUM(CASE WHEN side = 'credit' THEN amount ELSE 0 END), 0) AS credit_total
        FROM journal_lines
        WHERE user_id = ? AND account_code = ?
        """,
        (user_id, account_code),
    ).fetchone()

    if account_type in DEBIT_NORMAL_TYPES:
        return row["debit_total"] - row["credit_total"]
    return row["credit_total"] - row["debit_total"]


def list_accounts_with_balances(conn: Connection, user_id: int) -> list[ChartAccount]:
    rows = conn.execute(
        "SELECT code, name, type FROM accounts WHERE user_id = ? AND enabled = TRUE ORDER BY code",
        (user_id,),
    ).fetchall()
    return [
        ChartAccount(
            code=row["code"],
            name=row["name"],
            type=row["type"],
            balance=compute_balance(conn, user_id, row["code"], row["type"]),
        )
        for row in rows
    ]


def list_journal_entries(conn: Connection, user_id: int) -> list[JournalEntry]:
    entries = conn.execute(
        "SELECT id, date, description FROM journal_entries WHERE user_id = ? ORDER BY id",
        (user_id,),
    ).fetchall()

    result = []
    for entry in entries:
        lines = conn.execute(
            "SELECT account_code, side, amount FROM journal_lines WHERE entry_id = ? ORDER BY id",
            (entry["id"],),
        ).fetchall()
        debit = [JournalLine(account=l["account_code"], amount=l["amount"]) for l in lines if l["side"] == "debit"]
        credit = [JournalLine(account=l["account_code"], amount=l["amount"]) for l in lines if l["side"] == "credit"]
        result.append(
            JournalEntry(
                id=str(entry["id"]),
                date=entry["date"],
                description=entry["description"],
                debit=debit,
                credit=credit,
            )
        )
    return result


def general_ledger(conn: Connection, user_id: int) -> list[GeneralLedgerAccount]:
    accounts = conn.execute(
        "SELECT code, name, type FROM accounts WHERE user_id = ? AND enabled = TRUE ORDER BY code",
        (user_id,),
    ).fetchall()

    result = []
    for account in accounts:
        posting_rows = conn.execute(
            """
            SELECT je.date AS date, je.description AS description, jl.side AS side, jl.amount AS amount
            FROM journal_lines jl
            JOIN journal_entries je ON je.id = jl.entry_id
            WHERE jl.user_id = ? AND jl.account_code = ?
            ORDER BY je.date, je.id
            """,
            (user_id, account["code"]),
        ).fetchall()

        postings = [
            LedgerPosting(
                date=p["date"],
                description=p["description"],
                debit=p["amount"] if p["side"] == "debit" else 0,
                credit=p["amount"] if p["side"] == "credit" else 0,
            )
            for p in posting_rows
        ]

        result.append(
            GeneralLedgerAccount(
                code=account["code"],
                name=account["name"],
                type=account["type"],
                balance=compute_balance(conn, user_id, account["code"], account["type"]),
                postings=postings,
            )
        )
    return result


def balance_sheet(conn: Connection, user_id: int) -> BalanceSheet:
    accounts = list_accounts_with_balances(conn, user_id)
    assets = [a for a in accounts if a.type == "asset"]
    liabilities = [a for a in accounts if a.type == "liability"]
    equity = [a for a in accounts if a.type == "equity"]

    return BalanceSheet(
        assets=assets,
        liabilities=liabilities,
        equity=equity,
        totalAssets=sum(a.balance for a in assets),
        totalLiabilities=sum(a.balance for a in liabilities),
        totalEquity=sum(a.balance for a in equity),
    )


def profit_loss(conn: Connection, user_id: int) -> ProfitLoss:
    accounts = list_accounts_with_balances(conn, user_id)
    revenue = [a for a in accounts if a.type == "revenue"]
    expenses = [a for a in accounts if a.type == "expense"]
    total_revenue = sum(a.balance for a in revenue)
    total_expenses = sum(a.balance for a in expenses)

    return ProfitLoss(
        revenue=revenue,
        expenses=expenses,
        totalRevenue=total_revenue,
        totalExpenses=total_expenses,
        netIncome=total_revenue - total_expenses,
    )


def insert_journal_entry(conn: Connection, user_id: int, entry: JournalEntryInput) -> JournalEntry:
    cursor = conn.execute(
        "INSERT INTO journal_entries (user_id, date, description) VALUES (?, ?, ?) RETURNING id",
        (user_id, entry.date, entry.description),
    )
    entry_id = cursor.fetchone()["id"]

    for line in entry.debit:
        conn.execute(
            "INSERT INTO journal_lines (entry_id, user_id, account_code, side, amount) VALUES (?, ?, ?, 'debit', ?)",
            (entry_id, user_id, line.account, line.amount),
        )
    for line in entry.credit:
        conn.execute(
            "INSERT INTO journal_lines (entry_id, user_id, account_code, side, amount) VALUES (?, ?, ?, 'credit', ?)",
            (entry_id, user_id, line.account, line.amount),
        )

    conn.commit()

    return JournalEntry(
        id=str(entry_id),
        date=entry.date,
        description=entry.description,
        debit=entry.debit,
        credit=entry.credit,
    )
