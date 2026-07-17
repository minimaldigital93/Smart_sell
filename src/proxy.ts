import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // api/khqr is excluded: the webhook authenticates by signature, the status
    // poll by unguessable token, and the reconcile cron by bearer secret —
    // none need a session or tenant resolution (saves 2 Supabase round-trips
    // per poll).
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|api/khqr/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
