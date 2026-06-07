import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Use a relative Location so the browser resolves it against the host it
  // actually requested. Building an absolute URL from `request.url` would echo
  // the server's bind host (e.g. 0.0.0.0 in dev), which the browser can't reach.
  return new NextResponse(null, { status: 303, headers: { Location: "/" } });
}
