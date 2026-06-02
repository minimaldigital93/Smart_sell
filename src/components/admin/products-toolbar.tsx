"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/constants";

export function ProductsToolbar() {
  const router = useRouter();
  const search = useSearchParams();
  const [q, setQ] = useState(search.get("q") ?? "");
  const [category, setCategory] = useState(search.get("category") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      const qs = params.toString();
      router.replace(`/admin/products${qs ? `?${qs}` : ""}`);
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search name, SKU, barcode…"
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

      <select
        aria-label="Filter by category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="h-12 rounded-2xl border border-input bg-card px-4 text-[15px] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
