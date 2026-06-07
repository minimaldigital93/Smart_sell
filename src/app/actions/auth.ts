"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { humanizeAuthError } from "@/lib/auth/errors";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import {
  signInSchema,
  signUpSchema,
  resetRequestSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";

export type ActionState = { ok: boolean; error?: string; message?: string };

async function getOrigin() {
  const hdrs = await headers();
  const host = hdrs.get("host");
  const protocol = hdrs.get("x-forwarded-proto") ?? "http";
  return process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("auth:signin", 5, 60);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: humanizeAuthError(error) };

  const redirectTo = (formData.get("redirectTo") as string | null) || "/";
  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("auth:signup", 5, 60);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${origin}/auth/callback?next=/`,
    },
  });

  if (error) return { ok: false, error: humanizeAuthError(error) };

  // If the project requires email confirmation, session will be null.
  if (!data.session) {
    redirect("/login?confirm=1");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resetRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("auth:reset", 3, 600);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password/update`,
  });

  if (error) return { ok: false, error: humanizeAuthError(error) };
  return {
    ok: true,
    message:
      "If an account exists for that email, we sent a reset link. Check your inbox.",
  };
}

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("auth:update-password", 5, 600);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: humanizeAuthError(error) };

  revalidatePath("/", "layout");
  redirect("/account?reset=1");
}
