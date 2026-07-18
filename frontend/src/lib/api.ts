import { cookies } from "next/headers";
import type {
  AccountSetting,
  AccountType,
  AuthResponse,
  BalanceSheet,
  BusinessProfile,
  ChartAccount,
  ChatTurn,
  CurrentUser,
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

export const SESSION_COOKIE = "session_token";

async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

async function authHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers);
  const token = await getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function throwForResponse(res: Response, path: string): Promise<never> {
  let detail: string | undefined;
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string") {
      detail = body.detail;
    }
  } catch {
    // response body wasn't JSON; fall through to the generic message
  }
  throw new Error(detail ?? `Request to ${path} failed with status ${res.status}`);
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: await authHeaders(init),
    cache: "no-store",
  });

  if (!res.ok) {
    await throwForResponse(res, path);
  }

  return res.json() as Promise<T>;
}

export async function registerUser(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    await throwForResponse(res, "/api/auth/register");
  }
  return res.json() as Promise<AuthResponse>;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    await throwForResponse(res, "/api/auth/login");
  }
  return res.json() as Promise<AuthResponse>;
}

export async function logoutUser(): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;

  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => {
    // best effort — the cookie is cleared regardless, and session tokens
    // also expire on their own after 30 days
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) return null;
  if (!res.ok) await throwForResponse(res, "/api/auth/me");

  return res.json() as Promise<CurrentUser>;
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
    headers: await authHeaders(),
    cache: "no-store",
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    await throwForResponse(res, "/api/business-profile");
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
