"use client";

import { useActionState } from "react";
import { saveAccountSettings, type SettingsState } from "@/lib/actions";
import type { AccountSetting, AccountType } from "@/lib/types";

const initialState: SettingsState = { status: "idle" };

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
    saveAccountSettings,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <p className="text-sm text-zinc-500">
        Choose which accounts this company uses. Accounts you turn off
        disappear from the journal entry form, chat, General Ledger, Balance
        Sheet, and Profit &amp; Loss Statement.
      </p>

      {sectionOrder.map((type) => {
        const sectionAccounts = accounts.filter((a) => a.type === type);
        if (sectionAccounts.length === 0) return null;

        return (
          <div key={type}>
            <h2 className="mb-2 font-medium">{sectionTitles[type]}</h2>
            <div className="flex flex-col gap-1">
              {sectionAccounts.map((account) => (
                <label
                  key={account.code}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="enabledCodes"
                    value={account.code}
                    defaultChecked={account.enabled}
                  />
                  {account.name}
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
      )}
    </form>
  );
}
