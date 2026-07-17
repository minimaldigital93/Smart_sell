import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStoreId } from "@/lib/tenant/context";
import { getMyStoreId } from "@/services/stores";

export type CouponRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_subtotal: number;
  max_redemptions: number | null;
  redeemed_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listCoupons(): Promise<CouponRow[]> {
  const supabase = await createClient();
  // Active coupons are publicly readable (checkout preview), so scope the
  // admin list to the caller's store or it leaks other stores' codes (C3).
  const storeId = await getMyStoreId();
  let qb = supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (storeId) qb = qb.eq("store_id", storeId);
  const { data, error } = await qb;
  if (error) {
    console.error("[coupons.list]", error);
    return [];
  }
  return (data ?? []) as CouponRow[];
}

export async function getCoupon(id: string): Promise<CouponRow | null> {
  const supabase = await createClient();
  const storeId = await getMyStoreId();
  let qb = supabase.from("coupons").select("*").eq("id", id);
  if (storeId) qb = qb.eq("store_id", storeId);
  const { data, error } = await qb.maybeSingle<CouponRow>();
  if (error) {
    console.error("[coupons.get]", error);
    return null;
  }
  return data;
}

export async function findActiveCouponByCode(
  code: string,
): Promise<CouponRow | null> {
  const supabase = await createClient();
  const upper = code.toUpperCase();
  const nowIso = new Date().toISOString();
  const storeId = await getCurrentStoreId();
  let query = supabase
    .from("coupons")
    .select("*")
    .eq("code", upper)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (storeId) query = query.eq("store_id", storeId);
  const { data, error } = await query.maybeSingle<CouponRow>();
  if (error) {
    console.error("[coupons.findActive]", error);
    return null;
  }
  return data;
}
