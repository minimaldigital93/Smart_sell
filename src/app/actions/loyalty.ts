"use server";

import { createClient } from "@/lib/supabase/server";
import {
  pointsToUsd,
  MAX_POINTS_REDEMPTION_RATIO,
  POINTS_PER_DOLLAR_CREDIT,
} from "@/lib/loyalty/constants";

export type ValidatePointsResult =
  | { ok: true; pointsToRedeem: number; discount: number }
  | { ok: false; error: string };

/**
 * Server-side validation of a points redemption request.
 * Returns the clamped points amount and its USD discount value.
 * Does NOT deduct points — that happens inside submitOrderAction.
 */
export async function validatePointsRedemption(
  requestedPoints: number,
  subtotal: number,
): Promise<ValidatePointsResult> {
  if (requestedPoints <= 0) {
    return { ok: true, pointsToRedeem: 0, discount: 0 };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return { ok: false, error: "You must be signed in to use loyalty points." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("loyalty_points")
    .eq("id", userId)
    .maybeSingle();

  const available = profile?.loyalty_points ?? 0;
  if (available < requestedPoints) {
    return {
      ok: false,
      error: `You only have ${available} points available.`,
    };
  }

  // Cap at MAX_POINTS_REDEMPTION_RATIO of subtotal.
  const maxDiscount = Number(
    (subtotal * MAX_POINTS_REDEMPTION_RATIO).toFixed(2),
  );
  const requestedDiscount = pointsToUsd(requestedPoints);
  const actualDiscount = Math.min(requestedDiscount, maxDiscount);
  const actualPoints = Math.ceil(actualDiscount * POINTS_PER_DOLLAR_CREDIT);

  return {
    ok: true,
    pointsToRedeem: actualPoints,
    discount: actualDiscount,
  };
}
