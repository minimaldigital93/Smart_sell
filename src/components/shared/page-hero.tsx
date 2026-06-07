import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Cohesive gradient banner used as a page header across the storefront
 * (shop, category, cart). Soft glow orb + optional icon chip + title/subtitle.
 */
export function PageHero({
  title,
  subtitle,
  icon: Icon,
  gradient = "from-pink-100 via-nude-50 to-pink-200",
  iconClass = "text-pink-500",
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  gradient?: string;
  iconClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-xl bg-linear-to-br p-5 shadow-card",
        gradient,
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-3.5">
        {Icon ? (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/75 shadow-soft backdrop-blur">
            <Icon className={cn("h-6 w-6", iconClass)} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="relative">{children}</div> : null}
    </section>
  );
}
