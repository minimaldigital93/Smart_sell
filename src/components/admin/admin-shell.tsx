"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  ScanLine,
  Bell,
  LogOut,
  Tag,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRoleEnum } from "@/types/database";

type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const adminNav: readonly AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pos", label: "Sell", icon: Receipt },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/scan", label: "Scan", icon: ScanLine },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/notifications", label: "Alerts", icon: Bell },
];

export function AdminShell({
  children,
  userName,
  role,
  unreadNotifications = 0,
}: {
  children: React.ReactNode;
  userName: string;
  role: UserRoleEnum;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden border-r border-border bg-muted/40 md:flex md:w-60 md:flex-col md:p-4">
        <h2 className="px-2 py-3 text-sm font-semibold tracking-tight">Admin</h2>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
          {adminNav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            const showBadge = href === "/admin/notifications" && unreadNotifications > 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {showBadge ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-medium leading-tight">{userName}</p>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
            {role}
          </p>
          <form action="/auth/sign-out" method="post" className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl md:hidden safe-pt">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <h1 className="text-base font-semibold tracking-tight">Admin</h1>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {role}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 md:pb-8 md:pt-6">
          {children}
        </main>

        <nav
          className="sticky bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur-xl md:hidden safe-pb"
          aria-label="Admin"
        >
          <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1">
            {adminNav.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              const showBadge =
                href === "/admin/notifications" && unreadNotifications > 0;
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    className={cn(
                      "relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" />
                      {showBadge ? (
                        <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                          {unreadNotifications > 9 ? "9+" : unreadNotifications}
                        </span>
                      ) : null}
                    </span>
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
