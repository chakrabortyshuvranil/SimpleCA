# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

Frontend (`frontend/`, Next.js) and backend (`backend/`, FastAPI) are implemented per the spec below.

* Frontend: `cd frontend && npm run dev` (http://localhost:3000)
* Backend: `cd backend && uv run uvicorn app.main:app --reload --port 8000`

The Gemini API key in the root `.env` may be named `GEMINI_API_KEY` or `GOOGLE_API_KEY` — the backend accepts either.

The backend requires a `DATABASE_URL` environment variable (a Postgres connection string). For local development, run a disposable Postgres container, e.g.:

```
docker run -d --name simpleca-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=simpleca -p 5433:5432 postgres:16-alpine
export DATABASE_URL="postgresql://postgres:devpass@localhost:5433/simpleca"
```

### Deployment (Vercel)

The repository deploys as a single Vercel project using [Services](https://vercel.com/docs/services): the root `vercel.json` defines a `frontend` service (`frontend/`) and a `backend` service (`backend/`, entrypoint `app.main:app`), with `/api/*` rewritten to the backend and everything else to the frontend.

* Database: provision Postgres via a Marketplace integration (Neon is the direct successor to the discontinued Vercel Postgres) and set `DATABASE_URL` in Vercel Project Settings to the provided (pooled) connection string.
* `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) and optionally `GEMINI_MODEL` must also be set as Vercel environment variables — there is no `.env` file in production.
* The frontend does not need `API_BASE_URL` set manually in production: it self-references the current deployment via Vercel's auto-injected `VERCEL_URL`, so `/api/*` calls are routed to the backend service by the rewrite automatically, in both production and preview deployments.

# Simple Accounting Journal MVP

## Business Requirements

This project is building a simple Accounting Application.

The objective is to demonstrate how an AI Accounting Expert validates journal entries before they are posted to the General Ledger and automatically generates financial statements.

### Key Features

* Before anything else, the user completes a one-time setup: basic business details, and which Chart of Accounts accounts this company uses.
* A user can enter accounting journal entries either by describing the transaction in natural language in a chat window, or by filling in a manual debit/credit form.
* Every journal entry must be validated by an AI Accounting Expert before it is accepted, regardless of how it was entered.
* Only approved journal entries are saved.
* Approved journal entries are posted to the General Ledger.
* The application automatically updates the Balance Sheet after every approved journal entry.
* The application automatically updates the Profit & Loss Statement after every approved journal entry.
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
* Postgres database (a hosted Postgres provider such as Neon in production; a local Postgres container in development).
* No authentication.
* No tax calculations.
* No depreciation.
* No accruals.
* No inventory valuation: no automatic costing method (FIFO, weighted average, etc.) tracks what each unit of inventory cost. When inventory is sold, the cost of goods sold is whatever the user states in the moment — the application does not compute or look it up.
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
* 5300 Cost of Goods Sold

### Account selection

Which accounts this company uses is decided once, during onboarding (see below), and is locked afterward. The user can still add a brand-new account at any time — from onboarding itself, or later from the Settings screen — but cannot disable, re-enable, or remove an account that was already part of the locked set. Disabled accounts (only possible before locking) disappear from the journal entry form, the chat, the account dropdown, the General Ledger, the Balance Sheet, and the Profit & Loss Statement. Historical postings against a disabled account are preserved in the database and reappear if the account is re-enabled.

Account codes (e.g. `1000`) are internal identifiers used for referential integrity between the ledger and the Chart of Accounts. The UI never displays them — only account names are shown to the user. A new account added by the user is auto-assigned the next available code in its category's numeric block (1000s assets, 2000s liabilities, 3000s equity, 4000s revenue, 5000s expenses), spaced by 100 to match the predefined accounts above.

---

# Onboarding and Business Setup

Before using any other part of the application, the user must complete a one-time setup:

* Business name.
* Type of business (free text, e.g. "Sole Proprietorship").
* Business ID / registration number (free text).
* Address.
* Financial year (start date and end date).
* Which Chart of Accounts accounts this company uses, chosen from the predefined list above (all pre-selected by default), with the ability to add a custom account inline if something needed isn't in the list.

All other pages (Journal Entries, General Ledger, Balance Sheet, Profit & Loss, Settings) redirect to this setup screen until it has been completed. Once completed, the business profile cannot be re-submitted, and the Chart of Accounts selection is locked as described above — the backend rejects attempts to change it.

This setup information is stored for reference and display; per the Limitations above, the application does not use the financial year to filter, close, or restrict transactions (single accounting period).

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
* If not, ask exactly one short, specific clarifying question (for example, whether a purchase was paid in cash or on credit, or what a sold item cost) and propose nothing yet.
* If so, propose a balanced entry using only accounts from the supplied Chart of Accounts, with a brief explanation of the accounting treatment. A single entry may have more than one debit or credit line when a transaction has more than one accounting effect.
* Recognize that selling inventory has two effects, not one: the sale itself (debit Cash/Bank/Accounts Receivable, credit Sales Revenue, for the sale price) and the cost of goods sold (debit Cost of Goods Sold, credit Inventory, for what the goods originally cost) — both in the same compound entry. If the user hasn't stated what the sold goods cost, ask for it before proposing the entry.
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
* Postgres database, accessed via `psycopg` (v3)
* Deployed to Vercel as a single project using Services (see Deployment above)
* Use `uv` as the Python package manager.
* Use the official Google Gen AI Python SDK.
* Gemini API key stored in `.env` locally, and as a Vercel environment variable in production.
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
