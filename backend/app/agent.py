import json

from google.genai import types

from .config import ACCOUNTING_EXPERT_PROMPT_PATH, GEMINI_MODEL, create_gemini_client
from .schemas import AgentDecision


class AccountingExpertAgent:
    """Validates journal entries against the Chart of Accounts and current ledger
    balances using the Gemini API. Only ever returns a decision — it never writes
    to the database, executes SQL, or otherwise changes application data.
    """

    def __init__(self) -> None:
        self._client = create_gemini_client()
        self._system_prompt = ACCOUNTING_EXPERT_PROMPT_PATH.read_text()

    def validate(
        self,
        chart_of_accounts: list[dict],
        current_ledger_balances: list[dict],
        journal_entry: dict,
    ) -> AgentDecision:
        request_payload = {
            "chart_of_accounts": chart_of_accounts,
            "current_ledger_balances": current_ledger_balances,
            "journal_entry": journal_entry,
        }

        response = self._client.models.generate_content(
            model=GEMINI_MODEL,
            contents=json.dumps(request_payload),
            config=types.GenerateContentConfig(
                system_instruction=self._system_prompt,
                response_mime_type="application/json",
                response_schema=AgentDecision,
            ),
        )

        if response.parsed is not None:
            return response.parsed

        return AgentDecision.model_validate_json(response.text)
