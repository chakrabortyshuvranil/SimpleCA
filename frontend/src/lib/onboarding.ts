import { redirect } from "next/navigation";
import { getBusinessProfile, getCurrentUser } from "./api";
import type { BusinessProfile, CurrentUser } from "./types";

/**
 * Redirects to /login if there's no valid session. Must be called before any
 * try/catch in a page — redirect() throws a Next.js control-flow exception
 * that a surrounding catch would otherwise swallow.
 */
export async function requireAuthenticated(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Redirects to /login if not authenticated, or /onboarding if this user
 * hasn't completed setup yet.
 */
export async function requireOnboarded(): Promise<BusinessProfile> {
  await requireAuthenticated();

  const profile = await getBusinessProfile();
  if (!profile) {
    redirect("/onboarding");
  }
  return profile;
}
