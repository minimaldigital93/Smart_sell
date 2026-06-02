import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck } from "lucide-react";
import type { MovementWithProduct } from "@/services/inventory";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shop/empty-state";
import { ClientDate } from "@/components/shared/client-date";

const ICONS = {
  in: { Icon: ArrowDownToLine, className: "text-success" },
  out: { Icon: ArrowUpFromLine, className: "text-destructive" },
  adjustment: { Icon: ClipboardCheck, className: "text-muted-foreground" },
} as const;

export function MovementsTable({ rows }: { rows: MovementWithProduct[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No movements" description="Stock changes will appear here." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {rows.map((m) => {
        const meta = ICONS[m.movement_type];
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted",
                meta.className,
              )}
            >
              <meta.Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              {m.product ? (
                <Link
                  href={`/admin/inventory/products/${m.product_id}`}
                  className="line-clamp-1 text-sm font-medium hover:underline"
                >
                  {m.product.name}
                </Link>
              ) : (
                <p className="line-clamp-1 text-sm font-medium text-muted-foreground">
                  Deleted product
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                <ClientDate date={m.created_at} mode="distance" />
                {m.notes ? ` · ${m.notes}` : ""}
              </p>
            </div>
            {m.barcode_image_url ? (
              <a
                href={m.barcode_image_url}
                target="_blank"
                rel="noreferrer"
                aria-label="View barcode photo"
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
              >
                <Image
                  src={m.barcode_image_url}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </a>
            ) : null}
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  m.movement_type === "in" && "text-success",
                  m.movement_type === "out" && "text-destructive",
                )}
              >
                {m.movement_type === "in"
                  ? `+${m.quantity}`
                  : m.movement_type === "out"
                    ? `−${m.quantity}`
                    : `±${m.quantity}`}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                stock {m.resulting_stock}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
