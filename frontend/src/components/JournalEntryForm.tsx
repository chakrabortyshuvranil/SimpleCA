"use client";

import { useActionState, useRef, useState } from "react";
import { submitJournalEntry, type SubmitState } from "@/lib/actions";
import type { ChartAccount, JournalLine } from "@/lib/types";

const initialSubmitState: SubmitState = { status: "idle" };

function LineRow({
  namePrefix,
  accounts,
  onRemove,
  canRemove,
}: {
  namePrefix: "debit" | "credit";
  accounts: ChartAccount[];
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex gap-2">
      <select
        name={`${namePrefix}Account`}
        defaultValue=""
        required
        className="flex-1 rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
      >
        <option value="" disabled>
          Select account
        </option>
        {accounts.map((account) => (
          <option key={account.code} value={account.code}>
            {account.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        name={`${namePrefix}Amount`}
        step="0.01"
        min="0"
        placeholder="Amount"
        required
        className="w-32 rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="px-2 text-sm text-zinc-500 disabled:opacity-30"
        aria-label={`Remove ${namePrefix} line`}
      >
        &times;
      </button>
    </div>
  );
}

function CorrectionView({
  correction,
  accounts,
}: {
  correction: { debit: JournalLine[]; credit: JournalLine[] };
  accounts: ChartAccount[];
}) {
  const accountLabel = (code: string) =>
    accounts.find((a) => a.code === code)?.name ?? code;

  return (
    <div className="mt-2 rounded border border-black/10 p-3 text-sm dark:border-white/15">
      <p className="font-medium">Suggested correction</p>
      <div className="mt-1 grid grid-cols-2 gap-4">
        <div>
          <p className="text-zinc-500">Debit</p>
          {correction.debit.map((line, i) => (
            <p key={i}>
              {accountLabel(line.account)} — {line.amount}
            </p>
          ))}
        </div>
        <div>
          <p className="text-zinc-500">Credit</p>
          {correction.credit.map((line, i) => (
            <p key={i}>
              {accountLabel(line.account)} — {line.amount}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function JournalEntryForm({
  accounts,
}: {
  accounts: ChartAccount[];
}) {
  const [state, formAction, pending] = useActionState(
    submitJournalEntry,
    initialSubmitState,
  );
  const nextId = useRef(1);
  const [debitRows, setDebitRows] = useState<number[]>([0]);
  const [creditRows, setCreditRows] = useState<number[]>([0]);

  const addRow = (setRows: React.Dispatch<React.SetStateAction<number[]>>) =>
    setRows((rows) => [...rows, nextId.current++]);

  const removeRow = (
    setRows: React.Dispatch<React.SetStateAction<number[]>>,
    id: number,
  ) => setRows((rows) => rows.filter((row) => row !== id));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            name="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
          />
        </label>
        <label className="flex flex-[2] flex-col gap-1 text-sm">
          Description
          <input
            type="text"
            name="description"
            required
            className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Debit</p>
          {debitRows.map((id) => (
            <LineRow
              key={id}
              namePrefix="debit"
              accounts={accounts}
              canRemove={debitRows.length > 1}
              onRemove={() => removeRow(setDebitRows, id)}
            />
          ))}
          <button
            type="button"
            onClick={() => addRow(setDebitRows)}
            className="self-start text-sm text-zinc-500 hover:text-foreground"
          >
            + Add debit line
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Credit</p>
          {creditRows.map((id) => (
            <LineRow
              key={id}
              namePrefix="credit"
              accounts={accounts}
              canRemove={creditRows.length > 1}
              onRemove={() => removeRow(setCreditRows, id)}
            />
          ))}
          <button
            type="button"
            onClick={() => addRow(setCreditRows)}
            className="self-start text-sm text-zinc-500 hover:text-foreground"
          >
            + Add credit line
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Validating…" : "Submit for validation"}
      </button>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      {state.status === "result" && (
        <div
          className={
            state.result.approved
              ? "rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }
        >
          <p className="font-medium">
            {state.result.approved ? "Approved" : "Rejected"}
          </p>
          <p className="mt-1">{state.result.reason}</p>
          {!state.result.approved && state.result.correction && (
            <CorrectionView
              correction={state.result.correction}
              accounts={accounts}
            />
          )}
        </div>
      )}
    </form>
  );
}
