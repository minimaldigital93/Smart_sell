import { ScanModePicker } from "@/components/admin/scanner/scan-mode-picker";
import { ScanFlow } from "@/components/admin/scanner/scan-flow";

export const metadata = { title: "Scan barcode" };

type Mode = "in" | "out" | "lookup";
type SearchParams = Promise<{ mode?: string }>;

export default async function ScanPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const mode: Mode =
    sp.mode === "out" || sp.mode === "lookup" ? sp.mode : "in";

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Scan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Camera-based barcode scanning. EAN-13, UPC, Code128, QR.
        </p>
      </header>

      <ScanModePicker active={mode} />
      <ScanFlow mode={mode} />

      <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Tips</p>
        <ul className="mt-1 list-inside list-disc space-y-1">
          <li>HTTPS is required for the camera in production (localhost is exempt).</li>
          <li>Hold the phone 10–20 cm from the barcode in good light.</li>
          <li>Scan-out blocks if quantity exceeds on-hand stock.</li>
        </ul>
      </section>
    </div>
  );
}
