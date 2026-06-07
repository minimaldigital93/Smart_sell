import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type Bucket = { count: number; resetAt: number };

// Per-instance fallback only. The shared authority is the check_rate_limit
// Postgres RPC (migration 0026); this Map is used solely when that RPC is
// unreachable, so a DB hiccup degrades to local throttling rather than
// failing fully open.
const store = new Map<string, Bucket>();

const DEFAULT_SWEEP_AFTER = 5 * 60 * 1000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < DEFAULT_SWEEP_AFTER) return;
  lastSweep = now;
  for (const [key, b] of store) {
    if (b.resetAt <= now) store.delete(key);
  }
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const windowMs = windowSec * 1000;
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

export async function checkRateLimit(
  action: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const ip = await getClientIp();
  const key = `${action}:${ip}`;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_sec: windowSec,
    });
    if (error || !data) throw error ?? new Error("rate-limit: no data");

    const res = data as {
      allowed: boolean;
      remaining?: number;
      retry_after?: number;
    };
    return res.allowed
      ? { ok: true, remaining: res.remaining ?? 0 }
      : { ok: false, retryAfterSec: res.retry_after ?? windowSec };
  } catch (err) {
    // Shared store unavailable (e.g. migration not yet applied) — fall back to
    // the per-instance limiter so we still throttle a single hot instance.
    console.error("[rate-limit] falling back to in-memory:", err);
    return rateLimit(key, limit, windowSec);
  }
}

export function rateLimitMessage(retryAfterSec: number): string {
  if (retryAfterSec < 60) {
    return `Too many attempts. Try again in ${retryAfterSec}s.`;
  }
  const min = Math.ceil(retryAfterSec / 60);
  return `Too many attempts. Try again in ${min} min.`;
}
