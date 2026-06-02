"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ScanLine, ArrowDownToLine, ArrowUpFromLine, Eye } from "lucide-react";
import { BarcodeScanner } from "@/components/admin/scanner/barcode-scanner";
import { BarcodeProofCapture } from "@/components/admin/scanner/barcode-proof-capture";
import {
  lookupProductByBarcodeAction,
  type ScanLookupResult,
} from "@/app/actions/scan";
import { applyMovementAction } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";

type Mode = "in" | "out" | "lookup";

type Found = Extract<ScanLookupResult, { ok: true }>;

const MODE_META: Record<Mode, { label: string; verb: string; cta: string }> = {
  in: { label: "Stock in", verb: "added", cta: "Apply stock-in" },
  out: { label: "Stock out", verb: "removed", cta: "Apply stock-out" },
  lookup: { label: "Lookup", verb: "found", cta: "Open product" },
};

export function ScanFlow({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = MODE_META[mode];
  const photoRequired = mode === "in" || mode === "out";

  async function handleDecoded(text: string) {
    setScanning(false);
    const result = await lookupProductByBarcodeAction(text);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setFound(result);
    setQuantity(1);
    setProofUrl(null);

    if (mode === "lookup") {
      router.push(`/admin/inventory/products/${result.product.id}`);
    }
  }

  function reset() {
    setFound(null);
    setQuantity(1);
    setProofUrl(null);
  }

  function confirm() {
    if (!found) return;
    if (mode === "lookup") {
      router.push(`/admin/inventory/products/${found.product.id}`);
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be positive.");
      return;
    }
    if (photoRequired && !proofUrl) {
      toast.error("Attach a photo of the scanned barcode first.");
      return;
    }
    startTransition(async () => {
      const result = await applyMovementAction({
        productId: found.product.id,
        type: mode,
        quantity,
        notes: `scan ${mode}`,
        barcodeImageUrl: proofUrl ?? "",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${quantity} ${meta.verb} · now ${result.resultingStock} on hand`,
      );
      reset();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!found ? (
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => setScanning(true)}
        >
          <ScanLine className="h-5 w-5" />
          Start scan ({meta.label})
        </Button>
      ) : (
        <FoundCard
          found={found}
          mode={mode}
          quantity={quantity}
          onQuantityChange={setQuantity}
          proofUrl={proofUrl}
          onProofChange={setProofUrl}
          onScanAnother={() => {
            reset();
            setScanning(true);
          }}
          onConfirm={confirm}
          confirming={pending}
        />
      )}

      <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1">
          <ArrowDownToLine className="h-4 w-4" />
          Stock in
        </div>
        <div className="flex flex-col items-center gap-1">
          <ArrowUpFromLine className="h-4 w-4" />
          Stock out
        </div>
        <div className="flex flex-col items-center gap-1">
          <Eye className="h-4 w-4" />
          Lookup
        </div>
      </div>

      {scanning ? (
        <BarcodeScanner
          onDecoded={handleDecoded}
          onCancel={() => setScanning(false)}
        />
      ) : null}
    </div>
  );
}

function FoundCard({
  found,
  mode,
  quantity,
  onQuantityChange,
  proofUrl,
  onProofChange,
  onScanAnother,
  onConfirm,
  confirming,
}: {
  found: Found;
  mode: Mode;
  quantity: number;
  onQuantityChange: (q: number) => void;
  proofUrl: string | null;
  onProofChange: (url: string | null) => void;
  onScanAnother: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const cover = found.product.images[0] ?? null;
  const stock = found.inventory.current_stock;
  const meta = MODE_META[mode];
  const willOverdraw = mode === "out" && quantity > stock;
  const photoRequired = mode === "in" || mode === "out";
  const missingPhoto = photoRequired && !proofUrl;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {cover ? (
            <Image src={cover} alt="" fill sizes="64px" className="object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Scanned
          </p>
          <p className="line-clamp-2 text-base font-semibold leading-tight">
            {found.product.name}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {found.product.barcode}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            On hand
          </p>
          <p
            className={`text-xl font-semibold tabular-nums ${
              stock === 0 ? "text-destructive" : ""
            }`}
          >
            {stock}
          </p>
        </div>
      </div>

      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Price</span>
        <span className="font-medium tabular-nums">
          {formatPrice(found.product.discount_price ?? found.product.price)}
        </span>
      </div>

      {mode !== "lookup" ? (
        <div>
          <Label htmlFor="scan-qty">Quantity</Label>
          <Input
            id="scan-qty"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value) || 1))}
            className="!h-14 !text-lg"
            autoFocus
          />
          {willOverdraw ? (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              Only {stock} on hand — can&apos;t remove {quantity}.
            </p>
          ) : null}
        </div>
      ) : null}

      {photoRequired ? (
        <BarcodeProofCapture
          value={proofUrl}
          onChange={onProofChange}
          productId={found.product.id}
          disabled={confirming}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          disabled={
            confirming ||
            (mode === "out" && willOverdraw) ||
            missingPhoto
          }
          onClick={onConfirm}
        >
          {confirming
            ? "Saving…"
            : missingPhoto
              ? "Attach photo to continue"
              : meta.cta}
        </Button>
        <Button
          type="button"
          size="md"
          variant="outline"
          onClick={onScanAnother}
        >
          Scan another
        </Button>
      </div>
    </section>
  );
}
