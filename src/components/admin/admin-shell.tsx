"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
// useEffect is still used by MoreSheet for body-scroll locking.
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
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/shared/brand";
import { BackButton } from "@/components/shared/back-button";
import type { UserRoleEnum } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  adminOnly?: boolean;
  badge?: boolean;
};

// Four most-used destinations sit on the mobile tab bar; everything else lives
// behind "More" so the bar stays uncrowded and one-hand friendly.
const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/admin", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/admin/pos", label: "Sell", icon: Receipt },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
];

const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/scan", label: "Scan", icon: ScanLine },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/notifications", label: "Alerts", icon: Bell, badge: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
];

// Desktop sidebar reads better grouped by what the task is about.
const SIDEBAR_GROUPS: readonly { title: string; items: readonly NavItem[] }[] = [
  { title: "Overview", items: [PRIMARY_NAV[0]] },
  {
    title: "Sales",
    items: [PRIMARY_NAV[1], PRIMARY_NAV[2], SECONDARY_NAV[2]],
  },
  {
    title: "Catalog",
    items: [PRIMARY_NAV[3], SECONDARY_NAV[0], SECONDARY_NAV[1]],
  },
  { title: "System", items: [SECONDARY_NAV[3], SECONDARY_NAV[4]] },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function AdminShell({
  children,
  userName,
  role,
  isAdmin,
  unreadNotifications = 0,
  businessName,
  logoUrl,
}: {
  children: React.ReactNode;
  userName: string;
  role: UserRoleEnum;
  isAdmin: boolean;
  unreadNotifications?: number;
  businessName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // The dashboard is the admin "home"; every deeper page gets a Back affordance.
  const isRoot = pathname === "/admin";

  const visible = (item: NavItem) => !item.adminOnly || isAdmin;
  const secondary = SECONDARY_NAV.filter(visible);
  // A secondary destination is active → highlight the "More" tab.
  const moreActive = secondary.some((i) => isActive(pathname, i));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-muted/40 md:flex md:w-60 md:flex-col md:p-4">
        <div className="px-2 py-3">
          <Brand
            businessName={businessName}
            logoUrl={logoUrl}
            textClassName="text-sm"
          />
        </div>
        <nav className="flex flex-1 flex-col gap-4" aria-label="Admin">
          {SIDEBAR_GROUPS.map((group) => {
            const items = group.items.filter(visible);
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </p>
                {items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item)}
                    unread={unreadNotifications}
                  />
                ))}
              </div>
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
        {/* Mobile header */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl md:hidden safe-pt">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <Brand
              businessName={businessName}
              logoUrl={logoUrl}
              textClassName="text-base"
            />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {role}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 md:pb-8 md:pt-6">
          {!isRoot ? (
            <div className="mb-2 -ml-2">
              <BackButton fallbackHref="/admin" />
            </div>
          ) : null}
          {children}
        </main>

        {/* Mobile bottom tab bar: 4 tabs + More */}
        <nav
          className="sticky bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur-xl md:hidden safe-pb"
          aria-label="Admin"
        >
          <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href} className="flex-1">
                <TabLink item={item} active={isActive(pathname, item)} />
              </li>
            ))}
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={cn(
                  "relative flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors",
                  moreActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <MoreHorizontal className="h-5 w-5" />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  ) : null}
                </span>
                <span>More</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* More sheet (mobile) */}
      {moreOpen ? (
        <MoreSheet
          items={secondary}
          pathname={pathname}
          userName={userName}
          role={role}
          unread={unreadNotifications}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SidebarLink({
  item,
  active,
  unread,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
}) {
  const { href, label, icon: Icon } = item;
  const showBadge = item.badge && unread > 0;
  return (
    <Link
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
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, icon: Icon } = item;
  return (
    <Link
      href={href}
      className={cn(
        "relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}

function MoreSheet({
  items,
  pathname,
  userName,
  role,
  unread,
  onClose,
}: {
  items: readonly NavItem[];
  pathname: string;
  userName: string;
  role: UserRoleEnum;
  unread: number;
  onClose: () => void;
}) {
  // Lock body scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="More menu"
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-popover">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold leading-tight">{userName}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {role}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            const showBadge = item.badge && unread > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-accent text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-6 w-6" />
                <span>{item.label}</span>
                {showBadge ? (
                  <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <form action="/auth/sign-out" method="post" className="mt-4">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
