"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { humanizeAuthError } from "@/lib/auth/errors";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { normalizePhone, phoneToEmail } from "@/lib/auth/phone";
import {
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";

export type ActionState = { ok: boolean; error?: string; message?: string };

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("auth:signin", 5, 60);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }
  const parsed = signInSchema.safeParse({
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(parsed.data.phone),
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: humanizeAuthError(error) };

  // Honor an explicit redirect target (e.g. a protected page the user was
  // sent here from). Otherwise route by role: admins/staff to the dashboard,
  // everyone else to their own profile.
  const requested = (formData.get("redirectTo") as string | null) || "/";
  let destination = requested;
  if (requested === "/") {
    const userId = signInData.user?.id;
    let role: string | null = null;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      role = profile?.role ?? null;
    }
    destination = role === "admin" || role === "staff" ? "/admin" : "/account";
  }

  revalidatePath("/", "layout");
  redirect(destination);
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
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const normalizedPhone = normalizePhone(parsed.data.phone);

  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(parsed.data.phone),
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name, phone: normalizedPhone },
    },
  });

  if (error) return { ok: false, error: humanizeAuthError(error) };

  // No email confirmation for phone signups. If the project still has
  // "Confirm email" enabled, no session is returned — send them to sign in.
  if (!data.session) {
    redirect("/login?registered=1");
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
