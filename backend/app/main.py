import secrets
from contextlib import asynccontextmanager

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import ValidationError

from . import database, google_oauth, ledger
from .agent import AccountingExpertAgent
from .auth import CurrentUser, get_current_user, hash_password, verify_password
from .config import FRONTEND_BASE_URL
from .database import Connection
from .interpreter_agent import TransactionInterpreterAgent
from .schemas import (
    AccountSetting,
    AuthResponse,
    BalanceSheet,
    BusinessProfile,
    ChartAccount,
    ChatRequest,
    CurrentUserResponse,
    GeneralLedgerAccount,
    InterpreterResponse,
    JournalEntry,
    JournalEntryInput,
    LoginRequest,
    NewAccountInput,
    OnboardingRequest,
    ProfitLoss,
    RegisterRequest,
    ValidationResult,
)

agent = AccountingExpertAgent()
interpreter_agent = TransactionInterpreterAgent()


def build_agent_context(conn: Connection, user_id: int) -> tuple[list[dict], list[dict]]:
    accounts = ledger.list_accounts_with_balances(conn, user_id)
    chart_of_accounts = [{"code": a.code, "name": a.name, "type": a.type} for a in accounts]
    current_ledger_balances = [{"code": a.code, "balance": a.balance} for a in accounts]
    return chart_of_accounts, current_ledger_balances


def account_settings_list(conn: Connection, user_id: int) -> list[AccountSetting]:
    rows = database.list_all_accounts(conn, user_id)
    return [
        AccountSetting(code=r["code"], name=r["name"], type=r["type"], enabled=bool(r["enabled"]))
        for r in rows
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield


app = FastAPI(title="Accounting Journal MVP", lifespan=lifespan)


@app.post("/api/auth/register", response_model=AuthResponse)
def register(request: RegisterRequest) -> AuthResponse:
    with database.get_connection() as conn:
        if database.get_user_by_email(conn, request.email) is not None:
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        user_id = database.create_user(conn, request.email, hash_password(request.password))
        token, _ = database.create_session(conn, user_id)
        return AuthResponse(token=token, email=request.email)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(request: LoginRequest) -> AuthResponse:
    with database.get_connection() as conn:
        user = database.get_user_by_email(conn, request.email)
        if (
            user is None
            or user["password_hash"] is None  # Google-only account, no password set
            or not verify_password(request.password, user["password_hash"])
        ):
            raise HTTPException(status_code=401, detail="Incorrect email or password")

        token, _ = database.create_session(conn, user["id"])
        return AuthResponse(token=token, email=user["email"])


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)) -> dict:
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        with database.get_connection() as conn:
            database.delete_session(conn, token)
    return {"ok": True}


SESSION_COOKIE = "session_token"
SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days, matches database.SESSION_LIFETIME


@app.get("/api/auth/google/login")
def google_login() -> RedirectResponse:
    if not google_oauth.is_configured():
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    url, state = google_oauth.build_authorization_url()
    response = RedirectResponse(url)
    response.set_cookie(
        google_oauth.STATE_COOKIE,
        state,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=600,
    )
    return response


@app.get("/api/auth/google/callback")
def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    google_oauth_state: str | None = Cookie(default=None),
) -> RedirectResponse:
    failed = RedirectResponse(f"{FRONTEND_BASE_URL}/login?error=google_oauth_failed")

    if error or not code or not state or not google_oauth_state:
        return failed
    if not secrets.compare_digest(state, google_oauth_state):
        return failed

    try:
        email = google_oauth.exchange_code_for_email(code)
    except Exception:
        return failed

    with database.get_connection() as conn:
        user_id = database.get_or_create_user_by_google(conn, email)
        token, _ = database.create_session(conn, user_id)

    response = RedirectResponse(f"{FRONTEND_BASE_URL}/")
    response.delete_cookie(google_oauth.STATE_COOKIE)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=SESSION_COOKIE_MAX_AGE,
    )
    return response


@app.get("/api/auth/me", response_model=CurrentUserResponse)
def get_me(user: CurrentUser = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(email=user.email)


@app.get("/api/accounts", response_model=list[ChartAccount])
def get_accounts(user: CurrentUser = Depends(get_current_user)) -> list[ChartAccount]:
    with database.get_connection() as conn:
        return ledger.list_accounts_with_balances(conn, user.id)


@app.get("/api/journal-entries", response_model=list[JournalEntry])
def get_journal_entries(user: CurrentUser = Depends(get_current_user)) -> list[JournalEntry]:
    with database.get_connection() as conn:
        return ledger.list_journal_entries(conn, user.id)


@app.get("/api/general-ledger", response_model=list[GeneralLedgerAccount])
def get_general_ledger(user: CurrentUser = Depends(get_current_user)) -> list[GeneralLedgerAccount]:
    with database.get_connection() as conn:
        return ledger.general_ledger(conn, user.id)


@app.get("/api/balance-sheet", response_model=BalanceSheet)
def get_balance_sheet(user: CurrentUser = Depends(get_current_user)) -> BalanceSheet:
    with database.get_connection() as conn:
        return ledger.balance_sheet(conn, user.id)


@app.get("/api/profit-loss", response_model=ProfitLoss)
def get_profit_loss(user: CurrentUser = Depends(get_current_user)) -> ProfitLoss:
    with database.get_connection() as conn:
        return ledger.profit_loss(conn, user.id)


@app.get("/api/settings/accounts", response_model=list[AccountSetting])
def get_account_settings(user: CurrentUser = Depends(get_current_user)) -> list[AccountSetting]:
    with database.get_connection() as conn:
        return account_settings_list(conn, user.id)


@app.post("/api/accounts/custom", response_model=AccountSetting)
def add_custom_account(
    new_account: NewAccountInput, user: CurrentUser = Depends(get_current_user)
) -> AccountSetting:
    with database.get_connection() as conn:
        try:
            code = database.add_account(conn, user.id, new_account.name, new_account.type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return AccountSetting(code=code, name=new_account.name, type=new_account.type, enabled=True)


@app.get("/api/business-profile", response_model=BusinessProfile)
def get_business_profile(user: CurrentUser = Depends(get_current_user)) -> BusinessProfile:
    with database.get_connection() as conn:
        row = database.get_business_profile(conn, user.id)
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
def complete_onboarding(
    request: OnboardingRequest, user: CurrentUser = Depends(get_current_user)
) -> BusinessProfile:
    with database.get_connection() as conn:
        if database.is_setup_complete(conn, user.id):
            raise HTTPException(status_code=409, detail="Setup has already been completed")

        database.complete_onboarding(
            conn,
            user_id=user.id,
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
def post_chat(chat: ChatRequest, user: CurrentUser = Depends(get_current_user)) -> InterpreterResponse:
    with database.get_connection() as conn:
        chart_of_accounts, current_ledger_balances = build_agent_context(conn, user.id)

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
def post_journal_entry(
    entry: JournalEntryInput, user: CurrentUser = Depends(get_current_user)
) -> ValidationResult:
    with database.get_connection() as conn:
        chart_of_accounts, current_ledger_balances = build_agent_context(conn, user.id)

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
            result.entry = ledger.insert_journal_entry(conn, user.id, entry)

    return result
