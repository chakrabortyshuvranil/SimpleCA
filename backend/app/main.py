import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import ValidationError

from . import database, ledger
from .agent import AccountingExpertAgent
from .interpreter_agent import TransactionInterpreterAgent
from .schemas import (
    AccountSetting,
    BalanceSheet,
    ChartAccount,
    ChatRequest,
    GeneralLedgerAccount,
    InterpreterResponse,
    JournalEntry,
    JournalEntryInput,
    ProfitLoss,
    UpdateAccountSettings,
    ValidationResult,
)

agent = AccountingExpertAgent()
interpreter_agent = TransactionInterpreterAgent()


def build_agent_context(conn: sqlite3.Connection) -> tuple[list[dict], list[dict]]:
    accounts = ledger.list_accounts_with_balances(conn)
    chart_of_accounts = [{"code": a.code, "name": a.name, "type": a.type} for a in accounts]
    current_ledger_balances = [{"code": a.code, "balance": a.balance} for a in accounts]
    return chart_of_accounts, current_ledger_balances


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield


app = FastAPI(title="Accounting Journal MVP", lifespan=lifespan)


@app.get("/api/accounts", response_model=list[ChartAccount])
def get_accounts() -> list[ChartAccount]:
    with database.get_connection() as conn:
        return ledger.list_accounts_with_balances(conn)


@app.get("/api/journal-entries", response_model=list[JournalEntry])
def get_journal_entries() -> list[JournalEntry]:
    with database.get_connection() as conn:
        return ledger.list_journal_entries(conn)


@app.get("/api/general-ledger", response_model=list[GeneralLedgerAccount])
def get_general_ledger() -> list[GeneralLedgerAccount]:
    with database.get_connection() as conn:
        return ledger.general_ledger(conn)


@app.get("/api/balance-sheet", response_model=BalanceSheet)
def get_balance_sheet() -> BalanceSheet:
    with database.get_connection() as conn:
        return ledger.balance_sheet(conn)


@app.get("/api/profit-loss", response_model=ProfitLoss)
def get_profit_loss() -> ProfitLoss:
    with database.get_connection() as conn:
        return ledger.profit_loss(conn)


@app.get("/api/settings/accounts", response_model=list[AccountSetting])
def get_account_settings() -> list[AccountSetting]:
    with database.get_connection() as conn:
        rows = database.list_all_accounts(conn)
        return [
            AccountSetting(code=r["code"], name=r["name"], type=r["type"], enabled=bool(r["enabled"]))
            for r in rows
        ]


@app.put("/api/settings/accounts", response_model=list[AccountSetting])
def update_account_settings(settings: UpdateAccountSettings) -> list[AccountSetting]:
    with database.get_connection() as conn:
        database.set_enabled_accounts(conn, set(settings.enabledCodes))
        rows = database.list_all_accounts(conn)
        return [
            AccountSetting(code=r["code"], name=r["name"], type=r["type"], enabled=bool(r["enabled"]))
            for r in rows
        ]


@app.post("/api/chat", response_model=InterpreterResponse)
def post_chat(chat: ChatRequest) -> InterpreterResponse:
    with database.get_connection() as conn:
        chart_of_accounts, current_ledger_balances = build_agent_context(conn)

    try:
        return interpreter_agent.interpret(
            chart_of_accounts=chart_of_accounts,
            current_ledger_balances=current_ledger_balances,
            history=chat.history,
            message=chat.message,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"TransactionInterpreterAgent returned an unexpected response: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"TransactionInterpreterAgent error: {exc}"
        ) from exc


@app.post("/api/journal-entries", response_model=ValidationResult)
def post_journal_entry(entry: JournalEntryInput) -> ValidationResult:
    with database.get_connection() as conn:
        chart_of_accounts, current_ledger_balances = build_agent_context(conn)

    try:
        decision = agent.validate(
            chart_of_accounts=chart_of_accounts,
            current_ledger_balances=current_ledger_balances,
            journal_entry=entry.model_dump(),
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=502, detail=f"AccountingExpertAgent returned an unexpected response: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AccountingExpertAgent error: {exc}") from exc

    result = ValidationResult(**decision.model_dump())

    if result.approved:
        with database.get_connection() as conn:
            result.entry = ledger.insert_journal_entry(conn, entry)

    return result
