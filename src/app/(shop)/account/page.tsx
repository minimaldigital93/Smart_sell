import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getLoyaltyBalance, getLoyaltyHistory } from "@/services/loyalty";
import { formatPrice } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";
import { POINTS_PER_DOLLAR_CREDIT } from "@/lib/loyalty/constants";
import type { LoyaltyTransaction } from "@/types";

type SearchParams = Promise<{ reset?: string }>;

export default async function AccountPage(props: { searchParams: SearchParams }) {
  const session = await getCurrentProfile();
  const sp = await props.searchParams;

  if (!session) {
    // Render a sign-in prompt inside the shop layout so the bottom nav stays
    // visible and the user can still reach Home / Cart.
    return (
      <div className="flex flex-col gap-6 pt-2">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to view your profile, orders and loyalty points.
          </p>
        </header>
        <section className="flex flex-col gap-3">
          <Link
            href="/login?redirectTo=/account"
            className="rounded-2xl bg-primary px-5 py-4 text-center text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-2xl border border-border bg-card px-5 py-4 text-center text-sm font-medium shadow-soft hover:bg-muted"
          >
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {profile.name ?? user.email}
        </p>
      </header>

      {sp.reset ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Your password was updated.
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <dl className="grid grid-cols-1 gap-3 text-sm">
          <Row label="Email" value={user.email ?? "—"} />
          <Row label="Name" value={profile.name ?? "—"} />
          <Row label="Phone" value={profile.phone ?? "—"} />
          <Row label="Role" value={profile.role} mono />
        </dl>
      </section>

      {/* Loyalty points card */}
      <section className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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

      <section className="flex flex-col gap-3">
        <Link
          href="/orders"
          className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium shadow-soft hover:bg-muted"
        >
          My orders
        </Link>
        <Link
          href="/reset-password/update"
          className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium shadow-soft hover:bg-muted"
        >
          Change password
        </Link>
        {(profile.role === "admin" || profile.role === "staff") && (
          <Link
            href="/admin"
            className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium shadow-soft hover:bg-muted"
          >
            Admin dashboard
          </Link>
        )}
      </section>

      <SignOutButton />
    </div>
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
