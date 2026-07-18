"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthState } from "@/lib/actions";

const initialState: AuthState = { status: "idle" };

export default function LoginForm({
  next,
  googleLoginUrl,
}: {
  next: string;
  googleLoginUrl: string;
}) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex flex-col gap-4">
      <a
        href={googleLoginUrl}
        className="rounded border border-black/10 px-4 py-2 text-center text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        Continue with Google
      </a>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        or
        <div className="h-px flex-1 bg-black/10 dark:bg-white/15" />
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}
        <p className="text-sm text-zinc-500">
          Don&rsquo;t have an account?{" "}
          <Link href="/register" className="underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
