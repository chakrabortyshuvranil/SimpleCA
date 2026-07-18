import type {
  AccountSetting,
  AccountType,
  BalanceSheet,
  BusinessProfile,
  ChartAccount,
  ChatTurn,
  GeneralLedgerAccount,
  InterpreterResponse,
  JournalEntry,
  JournalEntryInput,
  OnboardingInput,
  ProfitLoss,
  ValidationResult,
} from "./types";

// On Vercel, VERCEL_PROJECT_PRODUCTION_URL is auto-injected with the
// project's stable production domain, so /api/* self-references through the
// vercel.json rewrite to the backend service with no manual configuration.
// (VERCEL_URL points at the unique per-deployment domain instead, which is
// subject to Deployment Protection and unusable for server-to-server fetches
// — Vercel's own docs call this out explicitly.)
// API_BASE_URL can still override this (e.g. for a separately hosted backend).
const API_BASE_URL =
  process.env.API_BASE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:8000");

// Only ever read server-side (no NEXT_PUBLIC_ prefix), so it's never shipped
// to the browser bundle. Required by the backend on every request when set.
function siteAuthHeaders(init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers);
  if (process.env.SITE_PASSWORD) {
    headers.set("X-Site-Password", process.env.SITE_PASSWORD);
  }
  return headers;
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: siteAuthHeaders(init),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function getAccounts(): Promise<ChartAccount[]> {
  return fetchJSON("/api/accounts");
}

export function getJournalEntries(): Promise<JournalEntry[]> {
  return fetchJSON("/api/journal-entries");
}

export function getGeneralLedger(): Promise<GeneralLedgerAccount[]> {
  return fetchJSON("/api/general-ledger");
}

export function getBalanceSheet(): Promise<BalanceSheet> {
  return fetchJSON("/api/balance-sheet");
}

export function getProfitLoss(): Promise<ProfitLoss> {
  return fetchJSON("/api/profit-loss");
}

export function postJournalEntry(
  entry: JournalEntryInput,
): Promise<ValidationResult> {
  return fetchJSON("/api/journal-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export function getAccountSettings(): Promise<AccountSetting[]> {
  return fetchJSON("/api/settings/accounts");
}

export function postChat(
  history: ChatTurn[],
  message: string,
): Promise<InterpreterResponse> {
  return fetchJSON("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message }),
  });
}

export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const res = await fetch(`${API_BASE_URL}/api/business-profile`, {
    headers: siteAuthHeaders(),
    cache: "no-store",
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(
      `Request to /api/business-profile failed with status ${res.status}`,
    );
  }

  return res.json() as Promise<BusinessProfile>;
}

export function submitOnboarding(
  input: OnboardingInput,
): Promise<BusinessProfile> {
  return fetchJSON("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function addCustomAccount(
  name: string,
  type: AccountType,
): Promise<AccountSetting> {
  return fetchJSON("/api/accounts/custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type }),
  });
}
