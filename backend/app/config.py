import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"

load_dotenv(ROOT_DIR / ".env")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

ACCOUNTING_EXPERT_PROMPT_PATH = ROOT_DIR / "prompts" / "accounting_expert.md"
TRANSACTION_INTERPRETER_PROMPT_PATH = ROOT_DIR / "prompts" / "transaction_interpreter.md"


def create_gemini_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY (or GOOGLE_API_KEY) is not set in the project root .env file"
        )
    return genai.Client(api_key=GEMINI_API_KEY)

DB_PATH = BACKEND_DIR / "accounting.db"

# Predefined Chart of Accounts (see CLAUDE.md). Fixed for this MVP.
CHART_OF_ACCOUNTS: list[tuple[str, str, str]] = [
    ("1000", "Cash", "asset"),
    ("1100", "Bank", "asset"),
    ("1200", "Accounts Receivable", "asset"),
    ("1300", "Inventory", "asset"),
    ("2000", "Accounts Payable", "liability"),
    ("2100", "Bank Loan", "liability"),
    ("3000", "Owner's Capital", "equity"),
    ("3100", "Retained Earnings", "equity"),
    ("4000", "Sales Revenue", "revenue"),
    ("5000", "Salary Expense", "expense"),
    ("5100", "Rent Expense", "expense"),
    ("5200", "Utilities Expense", "expense"),
]

DEBIT_NORMAL_TYPES = {"asset", "expense"}
