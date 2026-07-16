"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmProposedEntry,
  interpretChatMessage,
} from "@/lib/actions";
import { formatCurrency } from "@/lib/format";
import type {
  ChartAccount,
  ChatTurn,
  JournalLine,
  ProposedEntry,
} from "@/lib/types";

type Message = {
  role: "user" | "agent";
  content: string;
};

type EntryLinesShape = {
  debit: JournalLine[];
  credit: JournalLine[];
};

type PostResult =
  | { kind: "approved" }
  | { kind: "rejected"; reason: string; correction: EntryLinesShape | null };

function EntryLines({
  entry,
  accountNames,
}: {
  entry: EntryLinesShape;
  accountNames: Map<string, string>;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-zinc-500">Debit</p>
        {entry.debit.map((line, i) => (
          <p key={i}>
            {accountNames.get(line.account) ?? line.account} —{" "}
            {formatCurrency(line.amount)}
          </p>
        ))}
      </div>
      <div>
        <p className="text-zinc-500">Credit</p>
        {entry.credit.map((line, i) => (
          <p key={i}>
            {accountNames.get(line.account) ?? line.account} —{" "}
            {formatCurrency(line.amount)}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow({
  accounts,
}: {
  accounts: ChartAccount[];
}) {
  const router = useRouter();
  const accountNames = useMemo(
    () => new Map(accounts.map((a) => [a.code, a.name])),
    [accounts],
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingEntry, setPendingEntry] = useState<ProposedEntry | null>(null);
  const [postResult, setPostResult] = useState<PostResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const history: ChatTurn[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  function sendMessage() {
    const message = input.trim();
    if (!message || isPending) return;

    setInput("");
    setPostResult(null);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    startTransition(async () => {
      const result = await interpretChatMessage(history, message);

      if (result.status === "error") {
        setMessages((prev) => [
          ...prev,
          { role: "agent", content: result.message },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "agent", content: result.message },
      ]);

      if (result.status === "proposal" && result.proposedEntry) {
        setPendingEntry(result.proposedEntry);
      }
    });
  }

  function confirmEntry() {
    if (!pendingEntry) return;
    const entry = pendingEntry;

    startTransition(async () => {
      const submitState = await confirmProposedEntry(entry);
      setPendingEntry(null);

      if (submitState.status === "result" && submitState.result.approved) {
        setPostResult({ kind: "approved" });
        router.refresh();
      } else if (submitState.status === "result") {
        setPostResult({
          kind: "rejected",
          reason: submitState.result.reason,
          correction: submitState.result.correction,
        });
      } else if (submitState.status === "error") {
        setMessages((prev) => [
          ...prev,
          { role: "agent", content: submitState.message },
        ]);
      }
    });
  }

  function cancelEntry() {
    setPendingEntry(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/15">
      <p className="text-sm font-medium">
        Describe a transaction (e.g. &ldquo;purchased inventory of Rs.
        5000&rdquo;)
      </p>

      {messages.length > 0 && (
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "self-end rounded bg-foreground px-3 py-1.5 text-sm text-background"
                  : "self-start rounded bg-black/5 px-3 py-1.5 text-sm dark:bg-white/10"
              }
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      {isPending && (
        <p className="text-sm text-zinc-500">Thinking…</p>
      )}

      {pendingEntry && (
        <div className="rounded border border-black/10 p-3 dark:border-white/15">
          <p className="text-sm font-medium">Proposed entry</p>
          <p className="text-sm text-zinc-500">
            {pendingEntry.date} — {pendingEntry.description}
          </p>
          <EntryLines entry={pendingEntry} accountNames={accountNames} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmEntry}
              disabled={isPending}
              className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
            >
              Confirm & submit
            </button>
            <button
              type="button"
              onClick={cancelEntry}
              disabled={isPending}
              className="rounded border border-black/10 px-3 py-1.5 text-sm dark:border-white/15"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {postResult?.kind === "approved" && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          Approved and posted to the General Ledger.
        </p>
      )}

      {postResult?.kind === "rejected" && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Rejected</p>
          <p className="mt-1">{postResult.reason}</p>
          {postResult.correction && (
            <>
              <p className="mt-2 font-medium">Suggested correction</p>
              <EntryLines
                entry={postResult.correction}
                accountNames={accountNames}
              />
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a transaction…"
          className="flex-1 rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={isPending || !input.trim()}
          className="rounded bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
