import json
from datetime import date

from google.genai import types

from .config import GEMINI_MODEL, TRANSACTION_INTERPRETER_PROMPT_PATH, create_gemini_client
from .schemas import ChatTurn, InterpreterResponse


class TransactionInterpreterAgent:
    """Turns a natural-language transaction description into a proposed
    double-entry journal entry, or asks a clarifying question if it doesn't
    have enough information yet. It never writes to the database, executes
    code, or otherwise changes application data — and it does not perform
    the IFRS compliance review that's AccountingExpertAgent's job. Any entry
    it proposes still has to pass that validation before it can be posted.
    """

    def __init__(self) -> None:
        self._client = create_gemini_client()
        self._system_prompt = TRANSACTION_INTERPRETER_PROMPT_PATH.read_text()

    def interpret(
        self,
        chart_of_accounts: list[dict],
        current_ledger_balances: list[dict],
        history: list[ChatTurn],
        message: str,
    ) -> InterpreterResponse:
        conversation = [turn.model_dump() for turn in history]
        conversation.append({"role": "user", "content": message})

        request_payload = {
            "today": date.today().isoformat(),
            "chart_of_accounts": chart_of_accounts,
            "current_ledger_balances": current_ledger_balances,
            "conversation": conversation,
        }

        response = self._client.models.generate_content(
            model=GEMINI_MODEL,
            contents=json.dumps(request_payload),
            config=types.GenerateContentConfig(
                system_instruction=self._system_prompt,
                response_mime_type="application/json",
                response_schema=InterpreterResponse,
            ),
        )

        if response.parsed is not None:
            return response.parsed

        return InterpreterResponse.model_validate_json(response.text)
