import { NextResponse, type NextRequest } from "next/server";
import { getPaymentByToken, pollAndAdvance } from "@/services/payments";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Customer payment-status poll. Authenticated by the payment's unguessable
 * public_token (48 hex chars) — the customer paying an order may be a guest
 * with no session. Advances the payment (lazy expiry, gateway verify behind
 * the DB cooldown) on each call.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{16,64}$/i.test(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limited = await checkRateLimit(`khqr:status:${token.slice(0, 16)}`, 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const payment = await getPaymentByToken(token);
  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await pollAndAdvance(payment);
  return NextResponse.json({
    status: result.status,
    paid: result.paid,
    orderId: result.orderId,
    expiresAt: result.expiresAt,
  });
}
