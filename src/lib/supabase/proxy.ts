import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const ADMIN_PREFIX = "/admin";
const ACCOUNT_PREFIX = "/account";

// Auth pages that signed-in users should not see (except the password-reset
// update page, which requires an active recovery session).
const AUTH_GATE_PATHS = ["/login", "/register", "/reset-password"];
const AUTH_EXEMPT_PATHS = ["/reset-password/update"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isAccountRoute = pathname.startsWith(ACCOUNT_PREFIX);
  const isAuthGate =
    AUTH_GATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !AUTH_EXEMPT_PATHS.includes(pathname);

  // 1) Protect authed-only paths
  if ((isAdminRoute || isAccountRoute) && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirect);
  }

  // 2) Role gate /admin: must be admin or staff
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/";
      return NextResponse.redirect(redirect);
    }
  }

  // 3) Bounce signed-in users away from auth pages
  if (isAuthGate && user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    return NextResponse.redirect(redirect);
  }

  return response;
}
