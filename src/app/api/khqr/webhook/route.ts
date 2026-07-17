import { NextResponse, type NextRequest } from "next/server";
import { ingestKhqrWebhook } from "@/lib/khqrpay/webhook";

export const dynamic = "force-dynamic";

/**
 * khqr.cc settlement webhook. No session auth — every delivery is
 * authenticated by its sha256 signature against the settling store's secret
 * (see ingestKhqrWebhook for the idempotency/freshness/signature guards).
 * Accepts JSON and form-encoded bodies (the gateway posts form data).
 */
export async function POST(request: NextRequest) {
  const payload = await parseBody(request);
  const { status, body } = await ingestKhqrWebhook(payload);
  return NextResponse.json(body, { status });
}

async function parseBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as unknown;
      return json && typeof json === "object"
        ? (json as Record<string, unknown>)
        : {};
    }
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    form.forEach((value, key) => {
      out[key] = typeof value === "string" ? value : undefined;
    });
    return out;
  } catch {
    return {};
  }
}
