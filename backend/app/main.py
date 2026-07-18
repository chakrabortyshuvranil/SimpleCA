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
    BusinessProfile,
    ChartAccount,
    ChatRequest,
    GeneralLedgerAccount,
    InterpreterResponse,
    JournalEntry,
    JournalEntryInput,
    NewAccountInput,
    OnboardingRequest,
    ProfitLoss,
    ValidationResult,
)

agent = AccountingExpertAgent()
interpreter_agent = TransactionInterpreterAgent()


def build_agent_context(conn: sqlite3.Connection) -> tuple[list[dict], list[dict]]:
    accounts = ledger.list_accounts_with_balances(conn)
    chart_of_accounts = [{"code": a.code, "name": a.name, "type": a.type} for a in accounts]
    current_ledger_balances = [{"code": a.code, "balance": a.balance} for a in accounts]
    return chart_of_accounts, current_ledger_balances


def account_settings_list(conn: sqlite3.Connection) -> list[AccountSetting]:
    rows = database.list_all_accounts(conn)
    return [
        AccountSetting(code=r["code"], name=r["name"], type=r["type"], enabled=bool(r["enabled"]))
        for r in rows
    ]


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
        return account_settings_list(conn)


@app.post("/api/accounts/custom", response_model=AccountSetting)
def add_custom_account(new_account: NewAccountInput) -> AccountSetting:
    with database.get_connection() as conn:
        try:
            code = database.add_account(conn, new_account.name, new_account.type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return AccountSetting(code=code, name=new_account.name, type=new_account.type, enabled=True)


@app.get("/api/business-profile", response_model=BusinessProfile)
def get_business_profile() -> BusinessProfile:
    with database.get_connection() as conn:
        row = database.get_business_profile(conn)
        if row is None:
            raise HTTPException(status_code=404, detail="Business profile has not been set up yet")
        return BusinessProfile(
            businessName=row["business_name"],
            businessType=row["business_type"],
            businessId=row["business_id"],
            address=row["address"],
            fyStart=row["fy_start"],
            fyEnd=row["fy_end"],
        )


@app.post("/api/onboarding", response_model=BusinessProfile)
def complete_onboarding(request: OnboardingRequest) -> BusinessProfile:
    with database.get_connection() as conn:
        if database.is_setup_complete(conn):
            raise HTTPException(status_code=409, detail="Setup has already been completed")

        database.complete_onboarding(
            conn,
            business_name=request.businessName,
            business_type=request.businessType,
            business_id=request.businessId,
            address=request.address,
            fy_start=request.fyStart,
            fy_end=request.fyEnd,
            enabled_codes=set(request.enabledCodes),
        )
        return BusinessProfile(**request.model_dump(exclude={"enabledCodes"}))


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
