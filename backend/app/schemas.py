from typing import Literal, Optional

from pydantic import BaseModel

AccountType = Literal["asset", "liability", "equity", "revenue", "expense"]


class ChartAccount(BaseModel):
    code: str
    name: str
    type: AccountType
    balance: float


class AccountSetting(BaseModel):
    code: str
    name: str
    type: AccountType
    enabled: bool


class UpdateAccountSettings(BaseModel):
    enabledCodes: list[str]


class JournalLine(BaseModel):
    account: str
    amount: float


class JournalEntryInput(BaseModel):
    date: str
    description: str
    debit: list[JournalLine]
    credit: list[JournalLine]


class JournalEntry(JournalEntryInput):
    id: str


class Correction(BaseModel):
    debit: list[JournalLine]
    credit: list[JournalLine]


class AgentDecision(BaseModel):
    """Shape returned by AccountingExpertAgent. It never sees or sets `entry`."""

    approved: bool
    reason: str
    correction: Optional[Correction] = None


class ValidationResult(AgentDecision):
    entry: Optional[JournalEntry] = None


class LedgerPosting(BaseModel):
    date: str
    description: str
    debit: float
    credit: float


class GeneralLedgerAccount(BaseModel):
    code: str
    name: str
    type: AccountType
    balance: float
    postings: list[LedgerPosting]


class BalanceSheet(BaseModel):
    assets: list[ChartAccount]
    liabilities: list[ChartAccount]
    equity: list[ChartAccount]
    totalAssets: float
    totalLiabilities: float
    totalEquity: float


class ProfitLoss(BaseModel):
    revenue: list[ChartAccount]
    expenses: list[ChartAccount]
    totalRevenue: float
    totalExpenses: float
    netIncome: float


class ChatTurn(BaseModel):
    role: Literal["user", "agent"]
    content: str


class ChatRequest(BaseModel):
    history: list[ChatTurn]
    message: str


class ProposedEntry(BaseModel):
    date: str
    description: str
    debit: list[JournalLine]
    credit: list[JournalLine]


class InterpreterResponse(BaseModel):
    """Shape returned by TransactionInterpreterAgent. It never sees or sets
    anything beyond deciding whether to ask a follow-up question or propose
    an entry — it does not validate IFRS compliance and never touches the
    database. The proposed entry still passes through AccountingExpertAgent
    validation before it can be posted.
    """

    status: Literal["question", "proposal"]
    message: str
    proposedEntry: Optional[ProposedEntry] = None
