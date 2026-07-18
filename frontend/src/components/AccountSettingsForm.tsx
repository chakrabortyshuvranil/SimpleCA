"use client";

import { useActionState, useState } from "react";
import { addAccount, type AddAccountState } from "@/lib/actions";
import type { AccountSetting, AccountType } from "@/lib/types";

const initialState: AddAccountState = { status: "idle" };

const sectionOrder: AccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

const sectionTitles: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

export default function AccountSettingsForm({
  accounts,
}: {
  accounts: AccountSetting[];
}) {
  const [state, formAction, pending] = useActionState(
    addAccount,
    initialState,
  );
  const [type, setType] = useState<AccountType>("asset");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-500">
        This is the Chart of Accounts your business uses, set during setup.
        These accounts are locked and can&rsquo;t be removed or disabled, but
        you can add a new account below if you need one that isn&rsquo;t
        listed.
      </p>

      {sectionOrder.map((accType) => {
        const sectionAccounts = accounts.filter(
          (a) => a.type === accType && a.enabled,
        );
        if (sectionAccounts.length === 0) return null;

        return (
          <div key={accType}>
            <h2 className="mb-2 font-medium">{sectionTitles[accType]}</h2>
            <ul className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              {sectionAccounts.map((account) => (
                <li key={account.code}>{account.name}</li>
              ))}
            </ul>
          </div>
        );
      })}

      <form
        action={formAction}
        className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/15"
      >
        <p className="text-sm font-medium">Add a new account</p>
        <div className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="Account name"
            required
            className="flex-1 rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
          />
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className="rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
          >
            {sectionOrder.map((accType) => (
              <option key={accType} value={accType}>
                {sectionTitles[accType]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>

        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}
        {state.status === "added" && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Added {state.name}.
          </p>
        )}
      </form>
    </div>
  );
}
