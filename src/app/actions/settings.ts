"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/auth/session";
import { storeSettingsFormSchema } from "@/lib/settings/schema";

const LOGO_BUCKET = "branding";
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export type UpdateSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateStoreSettingsAction(
  formData: FormData,
): Promise<UpdateSettingsResult> {
  const { user, profile } = await requireAdmin();
  if (!profile.store_id) {
    return { ok: false, error: "No store is associated with this account." };
  }

  const parsed = storeSettingsFormSchema.safeParse({
    businessName: formData.get("businessName"),
    tagline: formData.get("tagline") ?? "",
    theme: formData.get("theme"),
    defaultLocale: formData.get("defaultLocale"),
    currency: formData.get("currency") ?? "USD",
    shippingFee: formData.get("shippingFee"),
    contactPhone: formData.get("contactPhone") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  // Optional logo: upload when a new file is provided, clear when asked.
  let logoUrl: string | null | undefined;
  const logo = formData.get("logo");
  const removeLogo = formData.get("removeLogo") === "true";

  if (logo instanceof File && logo.size > 0) {
    if (logo.size > LOGO_MAX_BYTES) {
      return { ok: false, error: "Logo must be 2 MB or smaller" };
    }
    if (!LOGO_MIME.includes(logo.type)) {
      return { ok: false, error: "Logo must be PNG, JPEG, WebP, or SVG" };
    }
    const ext = (logo.name.split(".").pop() ?? "png").toLowerCase().slice(0, 4);
    const path = `logo-${Date.now()}.${ext}`;
    const arrayBuf = await logo.arrayBuffer();

    // Prefer the service-role client so the write doesn't hinge on a storage
    // RLS policy; fall back to the admin's authenticated client.
    const writer = createServiceClient() ?? supabase;
    const { error: uploadError } = await writer.storage
      .from(LOGO_BUCKET)
      .upload(path, arrayBuf, {
        cacheControl: "3600",
        upsert: true,
        contentType: logo.type,
      });
    if (uploadError) {
      return { ok: false, error: "Logo upload failed. Please try again." };
    }
    const {
      data: { publicUrl },
    } = writer.storage.from(LOGO_BUCKET).getPublicUrl(path);
    logoUrl = publicUrl;
  } else if (removeLogo) {
    logoUrl = null;
  }

  const { error } = await supabase
    .from("store_settings")
    .update({
      business_name: parsed.data.businessName,
      tagline: parsed.data.tagline,
      theme: parsed.data.theme,
      default_locale: parsed.data.defaultLocale,
      currency: parsed.data.currency,
      shipping_fee: parsed.data.shippingFee,
      contact_phone: parsed.data.contactPhone || null,
      contact_address: parsed.data.contactAddress || null,
      updated_by: user.id,
      ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
    })
    .eq("store_id", profile.store_id);

  if (error) {
    return { ok: false, error: "Could not save settings. Please try again." };
  }

  // Branding/theme are read in the root layout, so refresh the whole tree.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { ok: true };
}
