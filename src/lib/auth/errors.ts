import type { AuthError } from "@supabase/supabase-js";

/**
 * Map raw Supabase auth errors to copy that's safe to show end-users.
 * Falls back to a generic message rather than leaking internals.
 */
export function humanizeAuthError(error: AuthError | Error | null): string {
  if (!error) return "Something went wrong. Please try again.";
  const msg = error.message?.toLowerCase() ?? "";

  if (msg.includes("invalid login credentials")) return "Wrong email or password.";
  if (msg.includes("email not confirmed"))
    return "Confirm your email — check your inbox for a verification link.";
  if (msg.includes("user already registered"))
    return "An account with that email already exists.";
  if (msg.includes("password should be"))
    return "Password must be at least 8 characters.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Too many attempts — please wait a minute and try again.";
  if (msg.includes("network")) return "Connection issue — please retry.";

  return "Sign-in failed. Please try again.";
}
