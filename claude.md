# Simple Accounting Journal MVP

## Business Requirements

This project is building a simple Accounting Application.

The objective is to demonstrate how an AI Accounting Expert validates journal entries before they are posted to the General Ledger and automatically generates financial statements.

### Key Features

* A user can enter accounting journal entries.
* Every journal entry must be validated by an AI Accounting Expert before it is accepted.
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

The application starts with the following accounts.

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

---

# AI Agent

The application contains one AI agent called:

**AccountingExpertAgent**

The Coding Agent must implement this agent.

The AccountingExpertAgent is responsible only for validating accounting journal entries.

The AccountingExpertAgent must **never**:

* Write directly to the database.
* Modify ledger balances.
* Update financial statements.
* Execute SQL.
* Make changes to application data.

Its only responsibility is to validate journal entries and return a structured decision.

---

# AI Agent Implementation

Implement an `AccountingExpertAgent` Python class.

The class must use the official Google Gen AI Python SDK.

Read the Gemini API key from the project root `.env` file.

Example:

```
GEMINI_API_KEY=xxxxxxxxxxxxxxxx
```

Use the latest stable Gemini reasoning model available at the time of implementation.

Store the AI system prompt in:

```
prompts/accounting_expert.md
```

The backend is responsible for creating the AccountingExpertAgent and calling it whenever a journal entry is submitted.

---

# Information Sent to the Agent

For every validation request, the backend must send:

* The system prompt.
* The predefined Chart of Accounts.
* The journal entry entered by the user.
* Current General Ledger balances.

The agent must only use the information supplied in the request.

The agent must never assume information that has not been provided.

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

# Agent Response

The AccountingExpertAgent must always return valid JSON.

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

---

# Application Flow

1. User enters a journal entry.

2. Backend sends:

   * System prompt
   * Chart of Accounts
   * Current ledger balances
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
* Use the latest stable Gemini reasoning model.
* Financial statement calculations are performed by the backend, not the AI.

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
