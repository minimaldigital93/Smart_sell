"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const selectClass =
  "h-12 rounded-2xl border border-input bg-card px-4 text-[15px] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

export function CategoriesToolbar() {
  const router = useRouter();
  const search = useSearchParams();
  const [q, setQ] = useState(search.get("q") ?? "");
  const [status, setStatus] = useState(search.get("status") ?? "all");
  const [sort, setSort] = useState(search.get("sort") ?? "order");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      if (sort !== "order") params.set("sort", sort);
      // changing any filter resets to page 1 (omit page param)
      const qs = params.toString();
      router.replace(`/admin/settings/categories${qs ? `?${qs}` : ""}`);
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, sort]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search categories…"
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
        aria-label="Filter by status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className={selectClass}
      >
        <option value="all">All status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <select
        aria-label="Sort categories"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className={selectClass}
      >
        <option value="order">Display order</option>
        <option value="name">Name</option>
        <option value="products">Most products</option>
        <option value="created">Newest</option>
        <option value="updated">Recently updated</option>
      </select>
    </div>
  );
}
