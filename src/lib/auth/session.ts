import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";
import type { UserRoleEnum } from "@/types/database";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentProfile(): Promise<{
  user: User;
  profile: Profile;
} | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return { user, profile };
}

/** Redirects to /login if no user. Returns the user otherwise. */
export async function requireUser(redirectTo = "/"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams({ redirectTo });
    redirect(`/login?${params.toString()}`);
  }
  return user;
}

/** Redirects home if the user's role is not in `allowed`. */
export async function requireRole(
  allowed: readonly UserRoleEnum[],
  redirectTo = "/",
): Promise<{ user: User; profile: Profile }> {
  const result = await getCurrentProfile();
  if (!result) {
    const params = new URLSearchParams({ redirectTo });
    redirect(`/login?${params.toString()}`);
  }
  if (!allowed.includes(result.profile.role)) {
    redirect("/");
  }
  return result;
}

export const requireStaff = (redirectTo = "/admin") =>
  requireRole(["admin", "staff", "superadmin"], redirectTo);
export const requireAdmin = (redirectTo = "/admin") =>
  requireRole(["admin", "superadmin"], redirectTo);

/** Redirects home unless the signed-in user is the platform superadmin. */
export const requireSuperadmin = (redirectTo = "/superadmin") =>
  requireRole(["superadmin"], redirectTo);
