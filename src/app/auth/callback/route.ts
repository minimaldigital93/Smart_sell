import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for Supabase email-confirmation, magic-link, and
 * password-reset emails. Exchanges the code in the URL for a session, then
 * redirects to ?next=... (defaulting to /).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=callback`);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
