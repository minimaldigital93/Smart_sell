import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "in", label: "Stock in", icon: ArrowDownToLine },
  { value: "out", label: "Stock out", icon: ArrowUpFromLine },
  { value: "lookup", label: "Lookup", icon: Eye },
] as const;

export function ScanModePicker({ active }: { active: string }) {
  return (
    <div
      role="tablist"
      aria-label="Scan mode"
      className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-soft"
    >
      {MODES.map((m) => {
        const Icon = m.icon;
        const isActive = active === m.value;
        return (
          <Link
            key={m.value}
            role="tab"
            aria-selected={isActive}
            href={`/admin/scan?mode=${m.value}`}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-foreground text-background shadow-soft"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}
