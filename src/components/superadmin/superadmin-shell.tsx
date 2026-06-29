"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users,
  CreditCard,
  Package,
  Wallet,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/shared/container";
import { signOutAction } from "@/app/actions/auth";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV: readonly NavItem[] = [
  { href: "/superadmin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/superadmin/stores", label: "Stores", icon: Store },
  { href: "/superadmin/users", label: "Users", icon: Users },
  { href: "/superadmin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/superadmin/plans", label: "Plans", icon: Package },
  { href: "/superadmin/finance", label: "Finance", icon: Wallet },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="bg-primary text-primary-foreground grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold">
        ✦
      </span>
      <span className="font-semibold tracking-tight">Platform Admin</span>
    </div>
  );
}

export function SuperadminShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="bg-muted/20 flex min-h-dvh flex-col lg:flex-row">
      {/* Desktop sidebar (lg+) */}
      <aside className="bg-background hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:p-4">
        <div className="px-2 py-3">
          <Logo />
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-1" aria-label="Platform">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-border bg-muted/40 mt-auto rounded-xl border p-3">
          <p className="text-sm font-medium leading-tight">{userName}</p>
          <p className="text-muted-foreground mt-0.5 text-xs uppercase tracking-wider">
            Superadmin
          </p>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="text-muted-foreground hover:bg-background hover:text-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile / tablet header with horizontal nav (below lg) */}
        <header className="bg-background safe-pt sticky top-0 z-10 border-b lg:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <Logo />
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {userName}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 py-6">
          <Container size="app">{children}</Container>
        </main>
      </div>
    </div>
  );
}
