import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductByIdAdmin } from "@/services/products-admin";
import { getInventory, listMovements } from "@/services/inventory";
import { MovementForm } from "@/components/admin/inventory/movement-form";
import { MovementsTable } from "@/components/admin/inventory/movements-table";
import { MinimumStockEditor } from "@/components/admin/inventory/minimum-stock-editor";
import { InventoryRealtimeRefresher } from "@/components/admin/inventory/inventory-realtime-refresher";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function InventoryProductPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const [product, inv, movements] = await Promise.all([
    getProductByIdAdmin(id),
    getInventory(id),
    listMovements({ productId: id, limit: 50 }),
  ]);
  if (!product) notFound();

  const onHand = inv?.current_stock ?? 0;
  const minimum = inv?.minimum_stock ?? 0;
  const low = onHand <= minimum;

  return (
    <div className="flex flex-col gap-6">
      <InventoryRealtimeRefresher />

      <header className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Inventory
          </p>
          <h1 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {product.sku ?? product.slug}
            {product.barcode ? ` · ${product.barcode}` : ""}
          </p>
        </div>
        <Link
          href={`/admin/products/${product.id}/edit`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Edit product →
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            On hand
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              onHand === 0 ? "text-destructive" : low ? "text-amber-600" : ""
            }`}
          >
            {onHand}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Minimum
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{minimum}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-border bg-card p-4 shadow-soft md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Status
          </p>
          <p className="mt-1 text-sm font-medium">
            {onHand === 0 ? (
              <span className="text-destructive">Out of stock</span>
            ) : low ? (
              <span className="text-amber-600">At or below minimum</span>
            ) : (
              <span className="text-success">Healthy</span>
            )}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            New movement
          </h2>
          <MovementForm
            productId={product.id}
            productName={product.name}
            currentStock={onHand}
          />
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Threshold
          </h2>
          <MinimumStockEditor productId={product.id} initialMinimum={minimum} />
          <p className="mt-2 text-xs text-muted-foreground">
            Products at or below this number appear in low-stock alerts.
          </p>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          History
        </h2>
        <MovementsTable rows={movements} />
      </section>
    </div>
  );
}
