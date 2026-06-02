import { createClient } from "@/lib/supabase/server";
import type { LoyaltyTransaction } from "@/types";

export async function getLoyaltyBalance(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("loyalty_points")
    .eq("id", userId)
    .maybeSingle();
  return data?.loyalty_points ?? 0;
}

export async function getLoyaltyHistory(
  userId: string,
  limit = 20,
): Promise<LoyaltyTransaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
