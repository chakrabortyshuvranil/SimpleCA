# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

Frontend (`frontend/`, Next.js) and backend (`backend/`, FastAPI) are implemented per the spec below.

* Frontend: `cd frontend && npm run dev` (http://localhost:3000)
* Backend: `cd backend && uv run uvicorn app.main:app --reload --port 8000`

The Gemini API key in the root `.env` may be named `GEMINI_API_KEY` or `GOOGLE_API_KEY` — the backend accepts either.

# Simple Accounting Journal MVP

## Business Requirements

This project is building a simple Accounting Application.

The objective is to demonstrate how an AI Accounting Expert validates journal entries before they are posted to the General Ledger and automatically generates financial statements.

### Key Features

* A user can enter accounting journal entries either by describing the transaction in natural language in a chat window, or by filling in a manual debit/credit form.
* Every journal entry must be validated by an AI Accounting Expert before it is accepted, regardless of how it was entered.
* Only approved journal entries are saved.
* Approved journal entries are posted to the General Ledger.
* The application automatically updates the Balance Sheet after every approved journal entry.
* The application automatically updates the Profit & Loss Statement after every approved journal entry.
* The user can choose which Chart of Accounts accounts this company uses; unused accounts are hidden throughout the app.
* The user can view:

  * Journal Entries
  * General Ledger
  * Balance Sheet
  * Profit & Loss Statement

---

# Limitations

This project is a Minimum Viable Product (MVP).

For this MVP:

* Single user.
* Single company.
* Single accounting period.
* Local SQLite database.
* Runs locally inside Docker.
* No authentication.
* No tax calculations.
* No depreciation.
* No accruals.
* No inventory valuation.
* No fixed assets.
* No budgeting.
* No multi-currency.
* No closing entries.
* No Cash Flow Statement.

Financial statements only need to support the predefined Chart of Accounts.

---

# Predefined Chart of Accounts

The application starts with the following accounts, all enabled by default.

## Assets

* 1000 Cash
* 1100 Bank
* 1200 Accounts Receivable
* 1300 Inventory

## Liabilities

* 2000 Accounts Payable
* 2100 Bank Loan

## Equity

* 3000 Owner's Capital
* 3100 Retained Earnings

## Revenue

* 4000 Sales Revenue

## Expenses

* 5000 Salary Expense
* 5100 Rent Expense
* 5200 Utilities Expense

### Account selection

The user can enable or disable individual accounts from a Settings screen, to reflect which accounts this company actually uses. Disabled accounts disappear from the journal entry form, the chat, the account dropdown, the General Ledger, the Balance Sheet, and the Profit & Loss Statement. Historical postings against a disabled account are preserved in the database and reappear if the account is re-enabled.

Account codes (e.g. `1000`) are internal identifiers used for referential integrity between the ledger and the Chart of Accounts. The UI never displays them — only account names are shown to the user.

---

# AI Agents

The application contains two AI agents:

**AccountingExpertAgent** — validates a journal entry (however it was entered) before it can be accepted.

**TransactionInterpreterAgent** — turns a natural-language transaction description, typed into the chat window, into a proposed journal entry, asking a clarifying question first if it doesn't have enough information.

The Coding Agent must implement both.

Neither agent may ever:

* Write directly to the database.
* Modify ledger balances.
* Update financial statements.
* Execute SQL.
* Make changes to application data.

Each agent's only responsibility is to return a structured decision. TransactionInterpreterAgent does not perform the IFRS compliance review — every entry it proposes still has to pass AccountingExpertAgent validation before it can be posted.

---

# AI Agent Implementation

Implement `AccountingExpertAgent` and `TransactionInterpreterAgent` as Python classes.

Both classes must use the official Google Gen AI Python SDK.

Read the Gemini API key from the project root `.env` file.

Example:

```
GEMINI_API_KEY=xxxxxxxxxxxxxxxx
```

Use the latest stable Gemini reasoning model available at the time of implementation. Make the model name configurable via a `GEMINI_MODEL` environment variable (with a stable default), since model availability changes over time.

Store each agent's system prompt in its own file:

```
prompts/accounting_expert.md
prompts/transaction_interpreter.md
```

The backend is responsible for creating both agents and calling them: `AccountingExpertAgent` whenever a journal entry is submitted (from the chat or the manual form), and `TransactionInterpreterAgent` whenever the user sends a chat message.

---

# Information Sent to the Agents

For every validation request, the backend must send `AccountingExpertAgent`:

* The system prompt.
* The Chart of Accounts (enabled accounts only).
* The journal entry entered by the user.
* Current General Ledger balances (enabled accounts only).

For every chat message, the backend must send `TransactionInterpreterAgent`:

* The system prompt.
* Today's date.
* The Chart of Accounts (enabled accounts only).
* Current General Ledger balances (enabled accounts only).
* The conversation so far (prior turns plus the latest user message). Conversation history is kept client-side and passed with each request — the backend does not persist chat sessions.

Both agents must only use the information supplied in the request. Neither agent may assume information that has not been provided.

---

# Responsibilities of the AccountingExpertAgent

The AccountingExpertAgent acts as an IFRS accounting reviewer.

For every journal entry it must:

* Verify total debits equal total credits.
* Verify every account exists in the Chart of Accounts.
* Verify account classifications are correct.
* Verify debit and credit directions are correct.
* Verify the accounting treatment follows IFRS principles.
* Verify the journal entry is logically consistent with the supplied account balances.
* Reject invalid accounting entries.
* Reject journal entries that violate business rules supplied by the application (for example, insufficient cash balance if negative cash balances are not allowed).

When rejecting an entry, the agent must:

* Explain why it is incorrect.
* Suggest a corrected journal entry whenever possible.

---

# Responsibilities of the TransactionInterpreterAgent

The TransactionInterpreterAgent acts as a bookkeeping assistant that turns a plain-language transaction description into a proposed double-entry journal entry.

For every chat message it must:

* Decide whether it has enough information to propose a correct double-entry treatment.
* If not, ask exactly one short, specific clarifying question (for example, whether a purchase was paid in cash or on credit) and propose nothing yet.
* If so, propose a balanced entry using only accounts from the supplied Chart of Accounts, with a brief explanation of the accounting treatment.
* Use today's date for the entry unless the user states a different date.
* Never invent an account that isn't in the supplied Chart of Accounts.

The TransactionInterpreterAgent does not itself verify IFRS compliance in depth — that check happens afterwards, when the user confirms the proposed entry and it is sent through AccountingExpertAgent validation like any other entry.

---

# Agent Response

Both agents must always return valid JSON.

## AccountingExpertAgent

Example of an approved entry:

```json
{
  "approved": true,
  "reason": "Journal entry is valid.",
  "correction": null
}
```

Example of a rejected entry:

```json
{
  "approved": false,
  "reason": "Cash balance is insufficient for this purchase.",
  "correction": {
    "debit": [
      {
        "account": "Inventory",
        "amount": 1000
      }
    ],
    "credit": [
      {
        "account": "Accounts Payable",
        "amount": 1000
      }
    ]
  }
}
```

## TransactionInterpreterAgent

Example of a clarifying question:

```json
{
  "status": "question",
  "message": "How was the inventory paid for? (e.g., cash, bank, or on credit)",
  "proposedEntry": null
}
```

Example of a proposed entry:

```json
{
  "status": "proposal",
  "message": "This is a cash purchase of inventory. Inventory is debited and Cash is credited.",
  "proposedEntry": {
    "date": "2026-07-17",
    "description": "Cash purchase of inventory",
    "debit": [
      {
        "account": "1300",
        "amount": 5000
      }
    ],
    "credit": [
      {
        "account": "1000",
        "amount": 5000
      }
    ]
  }
}
```

---

# Application Flow

1. User enters a journal entry, either:

   * **Via chat**: the user describes the transaction in natural language. The backend sends the conversation to TransactionInterpreterAgent, which either asks a clarifying question (repeat until it has enough information) or proposes a balanced entry for the user to confirm.
   * **Via the manual form**: the user directly fills in the date, description, and debit/credit lines.

2. Once a journal entry exists (typed manually, or confirmed from a chat proposal), the backend sends:

   * System prompt
   * Chart of Accounts (enabled accounts only)
   * Current ledger balances (enabled accounts only)
   * Journal entry

   to the AccountingExpertAgent.

3. The AccountingExpertAgent validates the entry.

4. If rejected:

   * Display the validation errors.
   * Display the suggested correction.
   * Do not save the journal entry.

5. If approved:

   * Save the journal entry.
   * Post the journal entry to the General Ledger.
   * Update account balances.
   * Recalculate the Balance Sheet.
   * Recalculate the Profit & Loss Statement.
   * Display the updated statements.

---

# Technical Decisions

* NextJS frontend
* Python FastAPI backend
* SQLite database
* Docker deployment
* Use `uv` as the Python package manager.
* Use the official Google Gen AI Python SDK.
* Gemini API key stored in `.env`.
* Use the latest stable Gemini reasoning model; model name is configurable via `GEMINI_MODEL` since availability shifts over time.
* Financial statement calculations are performed by the backend, not the AI.
* Chat conversation history lives client-side only (sent with each request) — no server-side chat session storage, to keep the single-user MVP simple.

---

# Coding Standards

* Use the latest stable libraries and idiomatic approaches.
* Keep the implementation simple.
* Never over-engineer.
* Build only the functionality required for the MVP.
* Keep business logic in the backend wherever possible.
* Use the AI only for accounting validation and reasoning.
* The backend owns:

  * Database access
  * General Ledger
  * Account balances
  * Financial statement calculations
* Always identify the root cause before fixing defects.
* Keep code modular and readable.
* Keep documentation concise.
* No emojis.

---

# Working Documentation

Store all project documentation in the `docs/` directory.

Review `docs/PLAN.md` before starting implementation.
