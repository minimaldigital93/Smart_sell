import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { getOrderForAdmin } from "@/services/orders-admin";
import { InvoiceView } from "@/components/admin/orders/invoice-view";
import { AutoPrint } from "@/components/admin/orders/auto-print";
import { PrintButton } from "@/components/admin/orders/print-button";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice" };

export default async function PrintOrderPage({ params }: { params: Params }) {
  await requireStaff();
  const { id } = await params;
  const data = await getOrderForAdmin(id);
  if (!data) notFound();

  return (
    <>
      <AutoPrint />
      <div className="print:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-8 pt-8 text-sm">
          <a href={`/admin/orders/${id}`} className="text-black/60 underline-offset-4 hover:underline">
            ← Back to order
          </a>
          <PrintButton />
        </div>
      </div>
      <InvoiceView order={data.order} items={data.items} />
    </>
  );
}
