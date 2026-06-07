import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth/session";
import { signOutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/superadmin", label: "Overview" },
  { href: "/superadmin/stores", label: "Stores" },
  { href: "/superadmin/users", label: "Users" },
  { href: "/superadmin/subscriptions", label: "Subscriptions" },
  { href: "/superadmin/plans", label: "Plans" },
  { href: "/superadmin/finance", label: "Finance" },
];

export default async function SuperadminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireSuperadmin();

  return (
    <div className="bg-muted/20 min-h-screen">
      <header className="bg-background sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold">
              ✦
            </span>
            <span className="font-semibold tracking-tight">Platform Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {profile.name ?? "Superadmin"}
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
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
