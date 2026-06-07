"use server";

import { promises as dns } from "node:dns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type DomainState = { ok: boolean; error?: string; message?: string };

/** Standard Vercel apex/CNAME targets; override per host with env if needed. */
export const DOMAIN_CNAME_TARGET =
  process.env.NEXT_PUBLIC_DOMAIN_CNAME_TARGET || "cname.vercel-dns.com";

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/,
    "Enter a valid domain like shop.example.com",
  );

export async function setCustomDomain(
  _prev: DomainState,
  formData: FormData,
): Promise<DomainState> {
  const { profile } = await requireAdmin();
  if (!profile.store_id) return { ok: false, error: "No store on this account." };

  const parsed = domainSchema.safeParse(formData.get("domain") ?? "");
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ custom_domain: parsed.data, domain_verified: false })
    .eq("id", profile.store_id);

  if (error) {
    // 23505 = unique violation (domain already used by another store).
    if (error.code === "23505") {
      return { ok: false, error: "That domain is already in use." };
    }
    return { ok: false, error: "Could not save domain. Please retry." };
  }

  revalidatePath("/admin/settings");
  return { ok: true, message: "Domain saved. Add the DNS record, then verify." };
}

/** Best-effort DNS check that the domain's CNAME points at the platform. */
export async function verifyCustomDomain(): Promise<DomainState> {
  const { profile } = await requireAdmin();
  if (!profile.store_id) return { ok: false, error: "No store on this account." };

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("custom_domain")
    .eq("id", profile.store_id)
    .maybeSingle();

  const domain = store?.custom_domain;
  if (!domain) return { ok: false, error: "Set a domain first." };

  let verified = false;
  try {
    const cnames = await dns.resolveCname(domain);
    verified = cnames.some((c) =>
      c.toLowerCase().includes(DOMAIN_CNAME_TARGET.toLowerCase()),
    );
  } catch {
    verified = false;
  }

  if (!verified) {
    return {
      ok: false,
      error: `DNS not pointing to ${DOMAIN_CNAME_TARGET} yet. It can take a few minutes to propagate.`,
    };
  }

  await supabase
    .from("stores")
    .update({ domain_verified: true })
    .eq("id", profile.store_id);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Domain verified! Your store is live on it." };
}

export async function removeCustomDomain(): Promise<DomainState> {
  const { profile } = await requireAdmin();
  if (!profile.store_id) return { ok: false, error: "No store on this account." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ custom_domain: null, domain_verified: false })
    .eq("id", profile.store_id);
  if (error) return { ok: false, error: "Could not remove domain." };
  revalidatePath("/admin/settings");
  return { ok: true, message: "Domain removed." };
}
