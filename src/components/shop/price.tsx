import { cn } from "@/lib/utils";
import { formatPrice, discountPercent } from "@/lib/utils";

export function Price({
  price,
  discount,
  size = "md",
  showBadge = false,
  className,
}: {
  price: number | string;
  discount?: number | string | null;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  className?: string;
}) {
  // Postgres numeric is serialized as string; coerce before comparing.
  const p = Number(price);
  const d = discount == null || discount === "" ? null : Number(discount);
  const hasDiscount = d != null && Number.isFinite(d) && d > 0 && d < p;
  const sizes = {
    sm: { current: "text-sm", strike: "text-xs" },
    md: { current: "text-base", strike: "text-sm" },
    lg: { current: "text-2xl", strike: "text-base" },
  } as const;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-1.5", className)}>
      <span className={cn("font-semibold tracking-tight", sizes[size].current)}>
        {formatPrice(hasDiscount ? discount : price)}
      </span>
      {hasDiscount ? (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through",
              sizes[size].strike,
            )}
          >
            {formatPrice(price)}
          </span>
          {showBadge ? (
            <span className="ml-auto rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-500">
              −{discountPercent(p, d!)}%
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
