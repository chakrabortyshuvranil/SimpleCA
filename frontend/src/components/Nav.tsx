"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";

const links = [
  { href: "/", label: "Journal Entries" },
  { href: "/general-ledger", label: "General Ledger" },
  { href: "/balance-sheet", label: "Balance Sheet" },
  { href: "/profit-loss", label: "Profit & Loss" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
        <span className="font-semibold">Accounting Journal MVP</span>
        <nav className="flex flex-1 gap-4 text-sm">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "font-medium text-foreground"
                    : "text-zinc-500 hover:text-foreground dark:text-zinc-400"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-foreground dark:text-zinc-400"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
