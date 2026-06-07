import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent section heading used across the storefront: an optional icon chip
 * (or accent bar) + title, with an optional "See all" link.
 */
export function SectionHeader({
  icon: Icon,
  title,
  href,
  linkLabel = "See all",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        {Icon ? (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-primary">
            <Icon className="h-4 w-4" />
          </span>
        ) : (
          <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
        )}
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
