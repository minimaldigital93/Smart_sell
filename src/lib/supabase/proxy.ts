import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { resolveStore } from "@/lib/tenant/resolve";
import {
  STORE_ID_HEADER,
  STORE_SLUG_HEADER,
  STORE_STATUS_HEADER,
} from "@/lib/tenant/context";
import { DEFAULT_STORE_SLUG } from "@/lib/constants";

const ADMIN_PREFIX = "/admin";
const ACCOUNT_PREFIX = "/account";
const SUPERADMIN_PREFIX = "/superadmin";
const BILLING_PATH = "/admin/billing";
const STORE_UNAVAILABLE_PATH = "/store-unavailable";

// Auth pages that signed-in users should not see.
const AUTH_GATE_PATHS = ["/login", "/register", "/reset-password"];
const AUTH_EXEMPT_PATHS = ["/reset-password/update"];

// Hosts that are NOT a customer store: the platform apex, Vercel previews and
// local dev. On these we fall back to the "default" store so the original
// single-tenant shop keeps working; real custom domains / `/s/{slug}` override.
function isPlatformHost(host: string): boolean {
  const h = host.split(":")[0].toLowerCase();
  const platform = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".vercel.app") ||
    (!!platform && (h === platform || h === `www.${platform}`))
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // ---- 1) Resolve tenant ----------------------------------------------------
  // `/s/{slug}/...` selects a store by slug (and is rewritten to the bare path);
  // a custom domain selects by host; otherwise the platform falls back to the
  // default store. The superadmin area is never store-bound.
  const segments = pathname.split("/");
  const pathSlug =
    segments[1] === "s" && segments[2] ? segments[2] : null;
  const platformHost = isPlatformHost(host);
  const isSuperadminRoute = pathname.startsWith(SUPERADMIN_PREFIX);

  const requestHeaders = new Headers(request.headers);

  let storeStatus: string | null = null;
  let strippedPath: string | null = null;

  if (!isSuperadminRoute) {
    // Lightweight read-only client just for the resolve_store RPC (no cookie
    // writes) so store headers are set before we build the response.
    const reader = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      },
    );

    const resolved = await resolveStore(reader, {
      host: pathSlug || platformHost ? null : host,
      slug: pathSlug ?? (platformHost ? DEFAULT_STORE_SLUG : null),
    });

    if (resolved) {
      requestHeaders.set(STORE_ID_HEADER, resolved.id);
      requestHeaders.set(STORE_SLUG_HEADER, resolved.slug);
      requestHeaders.set(STORE_STATUS_HEADER, resolved.status);
      storeStatus = resolved.status;
    }

    if (pathSlug) {
      // Map `/s/{slug}/rest` -> `/rest` for the (shop) routes to render.
      strippedPath = "/" + segments.slice(3).join("/");
    }
  }

  // ---- 2) Session client (can refresh auth cookies) -------------------------
  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
          response = NextResponse.next({ request: { headers: requestHeaders } });
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

  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isAccountRoute = pathname.startsWith(ACCOUNT_PREFIX);
  const isAuthGate =
    AUTH_GATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !AUTH_EXEMPT_PATHS.includes(pathname);

  const loadProfile = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return data;
  };

  // ---- 3) Superadmin area: superadmin role only ----------------------------
  if (isSuperadminRoute) {
    if (!user) return redirectTo(request, "/login", pathname);
    const profile = await loadProfile();
    if (!profile || profile.role !== "superadmin") {
      return redirectTo(request, "/");
    }
    return response;
  }

  // ---- 4) Protect authed-only paths ----------------------------------------
  if ((isAdminRoute || isAccountRoute) && !user) {
    return redirectTo(request, "/login", pathname);
  }

  // ---- 5) Role gate /admin: admin or staff (superadmin allowed too) --------
  if (isAdminRoute && user) {
    const profile = await loadProfile();
    if (
      !profile ||
      (profile.role !== "admin" &&
        profile.role !== "staff" &&
        profile.role !== "superadmin")
    ) {
      return redirectTo(request, "/");
    }
  }

  // ---- 6) Bounce signed-in users away from auth pages ----------------------
  if (isAuthGate && user) {
    return redirectTo(request, "/");
  }

  // ---- 7) Subscription lock enforcement ------------------------------------
  // A locked/cancelled store: storefront is hidden; admins are sent to billing.
  const locked = storeStatus === "locked" || storeStatus === "cancelled";
  if (locked) {
    if (isAdminRoute && pathname !== BILLING_PATH) {
      return redirectTo(request, BILLING_PATH);
    }
    if (!isAdminRoute && !isAccountRoute && pathname !== STORE_UNAVAILABLE_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = STORE_UNAVAILABLE_PATH;
      return rewriteWithCookies(url, requestHeaders, response);
    }
  }

  // ---- 8) Rewrite `/s/{slug}/...` to the bare storefront path ---------------
  if (strippedPath !== null) {
    const url = request.nextUrl.clone();
    url.pathname = strippedPath;
    return rewriteWithCookies(url, requestHeaders, response);
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string, redirectTo?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (redirectTo) url.searchParams.set("redirectTo", redirectTo);
  return NextResponse.redirect(url);
}

/** Rewrite to `url` while preserving store request headers + refreshed cookies. */
function rewriteWithCookies(
  url: URL,
  requestHeaders: Headers,
  prev: NextResponse,
) {
  const rewrite = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  prev.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
  return rewrite;
}
