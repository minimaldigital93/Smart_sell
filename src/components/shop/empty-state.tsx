import type { LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
      {Icon ? (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-linear-to-br from-pink-100 to-nude-100 text-pink-500 shadow-soft">
          <Icon className="h-6 w-6" />
        </span>
      ) : null}
      <p className="text-base font-medium">{title}</p>
      {description ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
