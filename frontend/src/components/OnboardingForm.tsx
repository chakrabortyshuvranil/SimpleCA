"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addAccountDuringOnboarding,
  completeOnboarding,
  type OnboardingState,
} from "@/lib/actions";
import type { AccountSetting, AccountType } from "@/lib/types";

const initialState: OnboardingState = { status: "idle" };

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

export default function OnboardingForm({
  initialAccounts,
}: {
  initialAccounts: AccountSetting[];
}) {
  const [state, formAction, pending] = useActionState(
    completeOnboarding,
    initialState,
  );

  const [accounts, setAccounts] = useState<AccountSetting[]>(initialAccounts);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialAccounts.filter((a) => a.enabled).map((a) => a.code)),
  );
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>("asset");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAddTransition] = useTransition();

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  function addCustomAccount() {
    const name = newName.trim();
    if (!name) return;

    setAddError(null);
    startAddTransition(async () => {
      const result = await addAccountDuringOnboarding(name, newType);
      if (!result.ok) {
        setAddError(result.message);
        return;
      }
      setAccounts((prev) => [...prev, result.account]);
      setSelected((prev) => new Set(prev).add(result.account.code));
      setNewName("");
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Business details</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Business name
            <input
              type="text"
              name="businessName"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Type of business
            <input
              type="text"
              name="businessType"
              placeholder="e.g. Sole Proprietorship"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Business ID / registration number
            <input
              type="text"
              name="businessId"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Address
            <input
              type="text"
              name="address"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Financial year start
            <input
              type="date"
              name="fyStart"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Financial year end
            <input
              type="date"
              name="fyEnd"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-medium">Chart of Accounts</h2>
          <p className="text-sm text-zinc-500">
            Choose which accounts your business uses. Once you finish setup,
            this list is locked — you can still add new accounts later, but
            not remove or disable these.
          </p>
        </div>

        {sectionOrder.map((type) => {
          const sectionAccounts = accounts.filter((a) => a.type === type);
          if (sectionAccounts.length === 0) return null;

          return (
            <div key={type}>
              <h3 className="mb-2 text-sm font-medium text-zinc-500">
                {sectionTitles[type]}
              </h3>
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
                      checked={selected.has(account.code)}
                      onChange={() => toggle(account.code)}
                    />
                    {account.name}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        <div className="rounded border border-black/10 p-3 dark:border-white/15">
          <p className="mb-2 text-sm font-medium">
            Don&rsquo;t see an account you need?
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Account name"
              className="flex-1 rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as AccountType)}
              className="rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            >
              {sectionOrder.map((type) => (
                <option key={type} value={type}>
                  {sectionTitles[type]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addCustomAccount}
              disabled={isAdding || !newName.trim()}
              className="rounded border border-black/10 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
            >
              {isAdding ? "Adding…" : "Add"}
            </button>
          </div>
          {addError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {addError}
            </p>
          )}
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Setting up…" : "Finish setup"}
      </button>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
