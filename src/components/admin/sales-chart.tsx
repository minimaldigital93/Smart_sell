import { format, parseISO } from "date-fns";
import type { SalesDay } from "@/services/admin";
import { formatPrice } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";

/**
 * Minimal SVG bar chart for daily revenue. Server-rendered — no chart library
 * required. Bars share a viewBox so they scale with width.
 */
export async function SalesChart({ data }: { data: SalesDay[] }) {
  const { currency } = await getStoreSettings();
  if (data.length === 0) {
    return (
      <div className="grid h-44 place-items-center rounded-2xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
        No sales yet
      </div>
    );
  }

  const max = Math.max(1, ...data.map((d) => Number(d.revenue)));
  const totalRevenue = data.reduce((s, d) => s + Number(d.revenue), 0);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);

  const W = data.length * 24;
  const H = 100;
  const barW = 14;
  const gap = 24;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Revenue · last {data.length} days
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatPrice(totalRevenue, currency)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalOrders} {totalOrders === 1 ? "order" : "orders"}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H + 16}`}
        preserveAspectRatio="none"
        className="mt-4 h-32 w-full"
        role="img"
        aria-label="Daily revenue chart"
      >
        {data.map((d, i) => {
          const rev = Number(d.revenue);
          const h = Math.round((rev / max) * H);
          const x = i * gap + (gap - barW) / 2;
          const y = H - h;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 1)}
                rx={3}
                className={
                  rev > 0
                    ? "fill-pink-400"
                    : "fill-border"
                }
              >
                <title>{`${format(parseISO(d.day), "MMM d")}: ${formatPrice(rev, currency)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}</title>
              </rect>
              {i % Math.max(1, Math.floor(data.length / 5)) === 0 ? (
                <text
                  x={x + barW / 2}
                  y={H + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {format(parseISO(d.day), "d MMM")}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
