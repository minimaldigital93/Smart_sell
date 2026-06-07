import Link from "next/link";
import {
  User,
  LogIn,
  UserPlus,
  Package,
  KeyRound,
  LayoutDashboard,
  ChevronRight,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getLoyaltyBalance, getLoyaltyHistory } from "@/services/loyalty";
import { formatPrice, cn } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";
import { PageHero } from "@/components/shared/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { POINTS_PER_DOLLAR_CREDIT } from "@/lib/loyalty/constants";
import type { LoyaltyTransaction } from "@/types";

type SearchParams = Promise<{ reset?: string }>;

function getInitials(name?: string | null, fallback?: string | null) {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/);
    return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (fallback ?? "?").slice(0, 1).toUpperCase();
}

export default async function AccountPage(props: { searchParams: SearchParams }) {
  const session = await getCurrentProfile();
  const sp = await props.searchParams;

  if (!session) {
    // Render a sign-in prompt inside the shop layout so the bottom nav stays
    // visible and the user can still reach Home / Cart.
    return (
      <div className="flex flex-col gap-6 pt-2">
        <PageHero
          icon={User}
          title="Account"
          subtitle="Sign in to view your profile, orders and loyalty points."
        />
        <section className="flex flex-col gap-3">
          <Link
            href="/login?redirectTo=/account"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
          >
            <UserPlus className="h-4 w-4" />
            Create an account
          </Link>
        </section>
      </div>
    );
  }
  const { user, profile } = session;

  const [loyaltyPoints, loyaltyHistory, { currency }] = await Promise.all([
    getLoyaltyBalance(profile.id),
    getLoyaltyHistory(profile.id, 10),
    getStoreSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Profile hero */}
      <section className="relative isolate overflow-hidden rounded-xl bg-linear-to-br from-pink-100 via-nude-50 to-pink-200 p-5 shadow-card">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/30 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/80 text-xl font-semibold text-pink-500 shadow-soft backdrop-blur">
            {getInitials(profile.name, user.email)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold leading-tight tracking-tight">
              {profile.name ?? "Welcome"}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {profile.phone ?? user.email}
            </p>
            <span className="mt-1.5 inline-flex rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-pink-500 backdrop-blur">
              {profile.role}
            </span>
          </div>
        </div>
      </section>

      {sp.reset ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Your password was updated.
        </p>
      ) : null}

      {/* Loyalty points card */}
      <section className="relative overflow-hidden rounded-2xl border border-pink-200 bg-linear-to-br from-pink-50 to-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-pink-100 text-pink-500">
              <Gift className="h-4 w-4" />
            </span>
            Loyalty points
          </h2>
          <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-bold text-pink-600">
            {loyaltyPoints} pts
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Earn 1 pt per {formatPrice(1, currency)} spent · {POINTS_PER_DOLLAR_CREDIT} pts = {formatPrice(1, currency)} off at checkout
        </p>

        {loyaltyHistory.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {loyaltyHistory.map((tx) => (
              <LoyaltyTxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No transactions yet. Place an order to start earning!
          </p>
        )}
      </section>

      {/* Profile details */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <dl className="grid grid-cols-1 gap-3 text-sm">
          <Row label="Email" value={user.email ?? "—"} />
          <Row label="Name" value={profile.name ?? "—"} />
          <Row label="Phone" value={profile.phone ?? "—"} />
          <Row label="Role" value={profile.role} mono />
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <MenuLink href="/orders" icon={Package} label="My orders" />
        <MenuLink
          href="/reset-password/update"
          icon={KeyRound}
          label="Change password"
        />
        {(profile.role === "admin" || profile.role === "staff") && (
          <MenuLink
            href="/admin"
            icon={LayoutDashboard}
            label="Admin dashboard"
          />
        )}
      </section>

      <SignOutButton />
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-medium shadow-soft transition-colors hover:bg-muted"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function LoyaltyTxRow({ tx }: { tx: LoyaltyTransaction }) {
  const isEarn = tx.type === "earn" || tx.type === "manual";
  const sign = isEarn ? "+" : "−";
  const colorClass = isEarn ? "text-success" : "text-pink-600";
  const label =
    tx.type === "earn"
      ? "Earned"
      : tx.type === "redeem"
        ? "Redeemed"
        : tx.type === "manual"
          ? "Adjusted"
          : "Expired";
  const date = new Date(tx.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li className="flex items-center justify-between text-xs">
      <div>
        <span className="font-medium">{label}</span>
        {tx.note ? (
          <span className="ml-1 text-muted-foreground">· {tx.note}</span>
        ) : null}
        <span className="ml-2 text-muted-foreground">{date}</span>
      </div>
      <span className={`font-semibold tabular-nums ${colorClass}`}>
        {sign}{tx.points} pts
      </span>
    </li>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm font-medium"}>{value}</dd>
    </div>
  );
}
