"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addCustomAccount,
  postChat,
  postJournalEntry,
  submitOnboarding,
} from "./api";
import type {
  AccountSetting,
  AccountType,
  ChatTurn,
  InterpreterResponse,
  JournalEntryInput,
  JournalLine,
  OnboardingInput,
  ValidationResult,
} from "./types";

export type AddAccountResult =
  | { ok: true; account: AccountSetting }
  | { ok: false; message: string };

export async function addAccountDuringOnboarding(
  name: string,
  type: AccountType,
): Promise<AddAccountResult> {
  try {
    const account = await addCustomAccount(name, type);
    return { ok: true, account };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not reach the accounting backend.",
    };
  }
}

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "result"; result: ValidationResult };

export type ChatResult =
  | InterpreterResponse
  | { status: "error"; message: string };

export type AddAccountState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "added"; name: string };

export type OnboardingState =
  | { status: "idle" }
  | { status: "error"; message: string };

function linesFromFormData(
  formData: FormData,
  accountField: string,
  amountField: string,
): JournalLine[] {
  const accounts = formData.getAll(accountField).map(String);
  const amounts = formData.getAll(amountField).map(String);

  return accounts
    .map((account, i) => ({ account, amount: Number(amounts[i]) }))
    .filter((line) => line.account && Number.isFinite(line.amount) && line.amount > 0);
}

async function validateAndSave(entry: JournalEntryInput): Promise<ValidationResult> {
  const result = await postJournalEntry(entry);

  if (result.approved) {
    revalidatePath("/");
    revalidatePath("/general-ledger");
    revalidatePath("/balance-sheet");
    revalidatePath("/profit-loss");
  }

  return result;
}

export async function submitJournalEntry(
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const date = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "");
  const debit = linesFromFormData(formData, "debitAccount", "debitAmount");
  const credit = linesFromFormData(formData, "creditAccount", "creditAmount");

  if (debit.length === 0 || credit.length === 0) {
    return {
      status: "error",
      message: "Enter at least one debit line and one credit line.",
    };
  }

  try {
    const result = await validateAndSave({ date, description, debit, credit });
    return { status: "result", result };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not reach the accounting backend.",
    };
  }
}

export async function confirmProposedEntry(
  entry: JournalEntryInput,
): Promise<SubmitState> {
  try {
    const result = await validateAndSave(entry);
    return { status: "result", result };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not reach the accounting backend.",
    };
  }
}

export async function interpretChatMessage(
  history: ChatTurn[],
  message: string,
): Promise<ChatResult> {
  try {
    return await postChat(history, message);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not reach the accounting backend.",
    };
  }
}

export async function addAccount(
  _prevState: AddAccountState,
  formData: FormData,
): Promise<AddAccountState> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as AccountType;

  if (!name || !type) {
    return { status: "error", message: "Enter a name and choose a category." };
  }

  try {
    await addCustomAccount(name, type);
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/general-ledger");
    revalidatePath("/balance-sheet");
    revalidatePath("/profit-loss");
    return { status: "added", name };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not reach the accounting backend.",
    };
  }
}

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const input: OnboardingInput = {
    businessName: String(formData.get("businessName") ?? "").trim(),
    businessType: String(formData.get("businessType") ?? "").trim(),
    businessId: String(formData.get("businessId") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    fyStart: String(formData.get("fyStart") ?? ""),
    fyEnd: String(formData.get("fyEnd") ?? ""),
    enabledCodes: formData.getAll("enabledCodes").map(String),
  };

  if (
    !input.businessName ||
    !input.businessType ||
    !input.businessId ||
    !input.address ||
    !input.fyStart ||
    !input.fyEnd
  ) {
    return { status: "error", message: "Please fill in every field." };
  }

  if (input.enabledCodes.length === 0) {
    return {
      status: "error",
      message: "Select at least one account to use.",
    };
  }

  try {
    await submitOnboarding(input);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not reach the accounting backend.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export type LoginState = { status: "idle" } | { status: "error"; message: string };

const SITE_AUTH_COOKIE = "site_auth";

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword || password !== sitePassword) {
    return { status: "error", message: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SITE_AUTH_COOKIE, sitePassword, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next || "/");
}
