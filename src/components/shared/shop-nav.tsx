"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Heart, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon; exact?: boolean };

// Desktop / tablet primary nav. On phones the bottom tab bar handles this, so
// this row is hidden below md and the items here mirror those destinations.
const LINKS: readonly NavLink[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/shop", label: "Shop", icon: Store },
  { href: "/wishlist", label: "Saved", icon: Heart },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/account", label: "Account", icon: User },
];

export function ShopNav() {
  const pathname = usePathname();

  return (
    <nav
      className="hidden items-center gap-1 md:flex"
      aria-label="Primary"
    >
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
