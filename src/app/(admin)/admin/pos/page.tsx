import { PosFlow } from "@/components/admin/pos/pos-flow";

export const metadata = { title: "Counter sale (POS)" };

export default function PosPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Counter sale</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan products to build a sale. Record sale to finalize the order
          and decrement stock.
        </p>
      </header>

      <PosFlow />
    </div>
  );
}
