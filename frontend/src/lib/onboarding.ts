import { redirect } from "next/navigation";
import { getBusinessProfile } from "./api";
import type { BusinessProfile } from "./types";

/**
 * Redirects to /onboarding if setup hasn't been completed yet. Must be
 * called before any try/catch in a page — redirect() throws a Next.js
 * control-flow exception that a surrounding catch would otherwise swallow.
 */
export async function requireOnboarded(): Promise<BusinessProfile> {
  const profile = await getBusinessProfile();
  if (!profile) {
    redirect("/onboarding");
  }
  return profile;
}
