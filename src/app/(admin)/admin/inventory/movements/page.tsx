import Link from "next/link";
import { listMovements } from "@/services/inventory";
import { MovementsTable } from "@/components/admin/inventory/movements-table";
import { InventoryRealtimeRefresher } from "@/components/admin/inventory/inventory-realtime-refresher";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory movements" };

type SearchParams = Promise<{ before?: string }>;

export default async function MovementsLogPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const rows = await listMovements({ limit: 50, before: sp.before });

  const olderCursor =
    rows.length === 50 ? rows[rows.length - 1]!.created_at : null;

  return (
    <div className="flex flex-col gap-5">
      <InventoryRealtimeRefresher />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Movements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Append-only ledger of every stock change.
        </p>
      </header>

      <MovementsTable rows={rows} />

      {olderCursor ? (
        <Link
          href={`/admin/inventory/movements?before=${encodeURIComponent(olderCursor)}`}
          className="self-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Load older →
        </Link>
      ) : null}
    </div>
  );
}
