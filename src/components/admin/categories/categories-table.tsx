import type { CategoryListItem } from "@/services/categories";
import { categoryVisual } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shop/empty-state";
import { CategoryActions } from "./category-actions";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US") : "—";
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      Inactive
    </span>
  );
}

function CategoryIcon({ cat }: { cat: CategoryListItem }) {
  const { Icon, color, iconClass } = categoryVisual(cat);
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
      <Icon
        className={cn("h-4 w-4", color ? undefined : iconClass)}
        style={color ? { color } : undefined}
      />
    </span>
  );
}

export function CategoriesTable({
  categories,
}: {
  categories: CategoryListItem[];
}) {
  if (categories.length === 0) {
    return (
      <EmptyState
        title="No categories"
        description="Create your first shop category to organize products."
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3">Products</th>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon cat={c} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="max-w-[16rem] truncate px-3 py-3 text-muted-foreground">
                  {c.description || "—"}
                </td>
                <td className="px-3 py-3 tabular-nums">{c.product_count}</td>
                <td className="px-3 py-3 tabular-nums">{c.display_order}</td>
                <td className="px-3 py-3">
                  <StatusPill active={c.is_active} />
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {formatDate(c.created_at)}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {formatDate(c.updated_at)}
                </td>
                <td className="px-3 py-3">
                  <CategoryActions
                    id={c.id}
                    name={c.name}
                    isActive={c.is_active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {categories.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <CategoryIcon cat={c} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  {c.description ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <StatusPill active={c.is_active} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {c.product_count}{" "}
                {c.product_count === 1 ? "product" : "products"} · order{" "}
                {c.display_order}
              </p>
              <CategoryActions
                id={c.id}
                name={c.name}
                isActive={c.is_active}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
