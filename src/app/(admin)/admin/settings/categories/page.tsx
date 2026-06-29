import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import {
  listCategoriesForAdmin,
  type CategorySortKey,
} from "@/services/categories";
import { CategoriesToolbar } from "@/components/admin/categories/categories-toolbar";
import { CategoriesTable } from "@/components/admin/categories/categories-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop Categories" };

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  q?: string;
  status?: "active" | "inactive" | "all";
  sort?: CategorySortKey;
  page?: string;
}>;

function buildHref(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return `/admin/settings/categories${qs ? `?${qs}` : ""}`;
}

export default async function CategoriesPage(props: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total } = await listCategoriesForAdmin({
    q: sp.q,
    status: sp.status ?? "all",
    sort: sp.sort ?? "order",
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = { q: sp.q, status: sp.status, sort: sp.sort };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Shop Categories
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize products. Active categories appear in the product form and
            storefront.
          </p>
        </div>
        <Link
          href="/admin/settings/categories/new"
          className="bg-primary text-primary-foreground inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium shadow-sm"
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </header>

      <CategoriesToolbar />
      <CategoriesTable categories={rows} />

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between pt-2"
          aria-label="Pagination"
        >
          <PageLink
            href={buildHref({ ...baseParams, page: String(page - 1) })}
            disabled={page <= 1}
            label="Previous"
          />
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <PageLink
            href={buildHref({ ...baseParams, page: String(page + 1) })}
            disabled={page >= totalPages}
            label="Next"
          />
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-full border border-border px-4 py-2 text-sm text-muted-foreground/50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"
    >
      {label}
    </Link>
  );
}
