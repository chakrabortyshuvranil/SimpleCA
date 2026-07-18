import AccountSettingsForm from "@/components/AccountSettingsForm";
import ErrorNotice from "@/components/ErrorNotice";
import { getAccountSettings } from "@/lib/api";
import { requireOnboarded } from "@/lib/onboarding";

export default async function SettingsPage() {
  await requireOnboarded();

  let accounts;

  try {
    accounts = await getAccountSettings();
  } catch (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : "Unknown error"}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <AccountSettingsForm accounts={accounts} />
    </div>
  );
}
