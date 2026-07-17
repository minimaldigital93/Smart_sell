import "server-only";
import { headers } from "next/headers";

/**
 * The origin the current request arrived on (custom store domain, platform
 * host, or localhost) — used to build absolute return URLs (e.g. the khqr.cc
 * success_url) that land the customer back on the SAME host they paid from.
 * Falls back to NEXT_PUBLIC_APP_URL when headers are unavailable.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
