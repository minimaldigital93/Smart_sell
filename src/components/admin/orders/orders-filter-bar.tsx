"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/constants";
import { STATUS_LABEL } from "@/lib/orders/transitions";

const STATUS_TABS = ["all", ...ORDER_STATUSES] as const;

export function OrdersFilterBar({
  counts,
}: {
  counts?: Partial<Record<string, number>>;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const active = search.get("status") ?? "all";
  const [q, setQ] = useState(search.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(search.toString());
      if (q.trim()) params.set("q", q.trim());
      else params.delete("q");
      router.replace(`/admin/orders${params.toString() ? `?${params}` : ""}`);
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar">
        {STATUS_TABS.map((tab) => {
          const isActive = active === tab;
          const params = new URLSearchParams(search.toString());
          if (tab === "all") params.delete("status");
          else params.set("status", tab);
          const href = `/admin/orders${params.toString() ? `?${params}` : ""}`;
          const count = tab === "all" ? undefined : counts?.[tab];
          return (
            <Link
              key={tab}
              href={href}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {tab === "all" ? "All" : STATUS_LABEL[tab]}
              {count != null ? (
                <span
                  className={cn(
                    "ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                    isActive
                      ? "bg-background text-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search name, phone, address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 w-full rounded-2xl border border-input bg-card pl-11 pr-11 text-[15px] placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
