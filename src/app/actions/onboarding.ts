"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { humanizeAuthError } from "@/lib/auth/errors";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { normalizePhone, phoneToEmail } from "@/lib/auth/phone";
import { slugify } from "@/lib/products/barcode";
import { isPlanCode } from "@/lib/billing/plans";

export type ActionState = { ok: boolean; error?: string };

const schema = z.object({
  businessName: z.string().trim().min(2, "Business name is required").max(60),
  name: z.string().trim().min(1, "Your name is required").max(60),
  phone: z.string().trim().min(6, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  planCode: z.string().refine(isPlanCode, "Please choose a plan"),
});

/**
 * Register a new shop owner: create the auth user, then (via the service-role
 * client, since stores are superadmin-insert only) create their store on the
 * plan they picked, and promote the profile to admin. There is no free trial —
 * the store starts locked and the owner is sent to billing to pay before it
 * goes live.
 */
export async function startStoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("onboarding:start", 5, 600);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }

  const parsed = schema.safeParse({
    businessName: formData.get("businessName"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    planCode: formData.get("planCode"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { businessName, name, phone, password, planCode } = parsed.data;

  const service = createServiceClient();
  if (!service) {
    return {
      ok: false,
      error: "Store signup is temporarily unavailable. Please contact support.",
    };
  }

  // 1) Create the owner account (handle_new_user creates a 'customer' profile).
  const supabase = await createClient();
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: phoneToEmail(phone),
    password,
    options: { data: { name, phone: normalizePhone(phone) } },
  });
  if (signUpErr) return { ok: false, error: humanizeAuthError(signUpErr) };
  const userId = signUpData.user?.id;
  if (!userId) return { ok: false, error: "Could not create your account." };

  // 2) Unique slug from the business name.
  const base = slugify(businessName) || "store";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await service
      .from("stores")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // 3) Create the store on the SELECTED plan, locked until paid (no trial).
  const { data: plan } = await service
    .from("subscription_plans")
    .select("id")
    .eq("code", planCode)
    .maybeSingle();

  const { data: store, error: storeErr } = await service
    .from("stores")
    .insert({
      slug,
      name: businessName,
      owner_id: userId,
      status: "locked",
      plan_id: plan?.id ?? null,
    })
    .select("id")
    .single();
  if (storeErr || !store) {
    console.error("[onboarding] create store", storeErr);
    return { ok: false, error: "Could not create your store. Please retry." };
  }

  // 4) Promote the profile to admin + attach the store, and record an unpaid
  //    subscription on the chosen plan (activated once the first payment lands).
  await service
    .from("profiles")
    .update({ role: "admin", store_id: store.id, name, phone: normalizePhone(phone) })
    .eq("id", userId);
  await service
    .from("subscriptions")
    .insert({
      store_id: store.id,
      plan_id: plan?.id ?? null,
      status: "past_due",
    });

  revalidatePath("/", "layout");
  // No trial: send the owner straight to billing to pay. If "Confirm email" is
  // on, there's no session yet — send them to sign in first.
  redirect(signUpData.session ? "/admin/billing" : "/login?registered=1");
}
