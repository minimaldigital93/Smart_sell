import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pollAndAdvance, type OrderPayment } from "@/services/payments";
import {
  pollSubscriptionPayment,
  type SubscriptionPaymentRow,
} from "@/services/subscription-billing";

export const dynamic = "force-dynamic";

/**
 * Reconcile cron — the safety net for missed webhooks: finalizes settled-but-
 * unnotified payments and expires stale QRs. Run every ~5 minutes (launchd on
 * the production Mac mini, see scripts/khqr-reconcile.plist.example).
 *
 * Guarded by `Authorization: Bearer $KHQR_RECONCILE_SECRET`.
 */
export async function POST(request: NextRequest) {
  return reconcile(request);
}

/** GET kept for curl convenience — same auth. */
export async function GET(request: NextRequest) {
  return reconcile(request);
}

async function reconcile(request: NextRequest) {
  const secret = process.env.KHQR_RECONCILE_SECRET;
  const provided = request.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: open, error } = await supabase
    .from("order_payments")
    .select("*")
    .in("status", ["pending", "qr_generated", "waiting_payment"])
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[khqr.reconcile] list", error);
    return NextResponse.json({ error: "Could not list payments" }, { status: 500 });
  }

  let finalized = 0;
  let expired = 0;
  for (const payment of (open ?? []) as OrderPayment[]) {
    const result = await pollAndAdvance(payment, { force: true });
    if (result.paid) finalized += 1;
    else if (result.status === "expired") expired += 1;
  }

  // Open khqr subscription payments (platform-settled) get the same sweep.
  const { data: openSubs } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("method", "khqr")
    .not("transaction_id", "is", null)
    .in("status", ["pending", "qr_generated", "waiting_payment"])
    .order("created_at", { ascending: true })
    .limit(50);

  for (const payment of (openSubs ?? []) as SubscriptionPaymentRow[]) {
    const result = await pollSubscriptionPayment(payment, { force: true });
    if (result.paid) finalized += 1;
    else if (result.status === "expired") expired += 1;
  }

  return NextResponse.json({
    checked: (open?.length ?? 0) + (openSubs?.length ?? 0),
    finalized,
    expired,
  });
}
