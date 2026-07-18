"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register, type AuthState } from "@/lib/actions";

const initialState: AuthState = { status: "idle" };

export default function RegisterForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input
        type="email"
        name="email"
        placeholder="Email"
        required
        autoFocus
        className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        required
        minLength={8}
        className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Register"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <p className="text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
