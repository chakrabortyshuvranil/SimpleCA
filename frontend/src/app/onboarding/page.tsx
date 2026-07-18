import { redirect } from "next/navigation";
import ErrorNotice from "@/components/ErrorNotice";
import OnboardingForm from "@/components/OnboardingForm";
import { getAccountSettings, getBusinessProfile } from "@/lib/api";
import { requireAuthenticated } from "@/lib/onboarding";

export default async function OnboardingPage() {
  // Not wrapped in try/catch: redirect() throws a Next.js control-flow
  // exception that a surrounding catch would otherwise swallow.
  await requireAuthenticated();

  const profile = await getBusinessProfile();
  if (profile) {
    redirect("/");
  }

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
      <div>
        <h1 className="text-xl font-semibold">Welcome</h1>
        <p className="text-sm text-zinc-500">
          Let&rsquo;s set up your business before you start recording
          transactions.
        </p>
      </div>
      <OnboardingForm initialAccounts={accounts} />
    </div>
  );
}
