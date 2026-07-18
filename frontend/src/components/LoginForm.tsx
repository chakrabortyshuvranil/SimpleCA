"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/actions";

const initialState: LoginState = { status: "idle" };

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="password"
        placeholder="Password"
        required
        autoFocus
        className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Checking…" : "Enter"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
