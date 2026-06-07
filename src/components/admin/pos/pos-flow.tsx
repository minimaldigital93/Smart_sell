"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ScanLine, Minus, Plus, Trash2, Receipt } from "lucide-react";
import { BarcodeScanner } from "@/components/admin/scanner/barcode-scanner";
import { lookupProductByBarcodeAction } from "@/app/actions/scan";
import { submitCounterSaleAction } from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormatPrice } from "@/lib/settings/store-config";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/constants";
import { PAYMENT_INSTRUCTIONS } from "@/lib/checkout/payment-instructions";

type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  onHand: number;
  cover: string | null;
  barcode: string | null;
};

export function PosFlow() {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const [scanning, setScanning] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, startTransition] = useTransition();

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    return {
      subtotal: Number(subtotal.toFixed(2)),
      itemCount,
    };
  }, [lines]);

  async function handleDecoded(text: string) {
    setScanning(false);
    const lookup = await lookupProductByBarcodeAction(text);
    if (!lookup.ok) {
      toast.error(lookup.error);
      return;
    }
    const { product, inventory } = lookup;
    if (!product.is_active) {
      toast.error(`${product.name} is not active.`);
      return;
    }
    // Postgres `numeric` arrives as a string; coerce, and treat a 0 discount
    // as "no discount" so we don't accidentally sell at $0.
    const priceNum = Number(product.price);
    const discountNum =
      product.discount_price == null ? 0 : Number(product.discount_price);
    const unitPrice =
      discountNum > 0 && discountNum < priceNum ? discountNum : priceNum;
    if (!(unitPrice > 0)) {
      toast.error(`${product.name} has no price set.`);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > inventory.current_stock) {
          toast.error(`Only ${inventory.current_stock} in stock.`);
          return prev;
        }
        toast.success(`+1 ${product.name}`);
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      if (inventory.current_stock < 1) {
        toast.error(`${product.name} is out of stock.`);
        return prev;
      }
      toast.success(`Added ${product.name}`);
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice,
          quantity: 1,
          onHand: inventory.current_stock,
          cover: product.images[0] ?? null,
          barcode: product.barcode ?? null,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.productId !== productId) return l;
          const next = l.quantity + delta;
          if (next > l.onHand) {
            toast.error(`Only ${l.onHand} in stock.`);
            return l;
          }
          return { ...l, quantity: next };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function submit() {
    if (lines.length === 0) {
      toast.error("Scan at least one item.");
      return;
    }
    startTransition(async () => {
      const result = await submitCounterSaleAction({
        payment_method: payment,
        customer_name: customerName,
        phone,
        note,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sale recorded · ${formatPrice(result.total)}`);
      setLines([]);
      setCustomerName("");
      setPhone("");
      setNote("");
      router.push(`/admin/orders/${result.orderId}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => setScanning(true)}
      >
        <ScanLine className="h-5 w-5" />
        Scan to add item
      </Button>

      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Items {lines.length > 0 ? `(${totals.itemCount})` : ""}
          </h2>
          {lines.length > 0 ? (
            <button
              type="button"
              onClick={() => setLines([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </header>

        {lines.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Scan a product barcode to add it to the sale.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 p-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {l.cover ? (
                    <Image
                      src={l.cover}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-tight">
                    {l.name}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {formatPrice(l.unitPrice)} · {l.onHand} on hand
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeQty(l.productId, -1)}
                    aria-label="Decrease quantity"
                    className="grid h-9 w-9 place-items-center rounded-full bg-muted hover:bg-muted/70"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-7 text-center text-base font-semibold tabular-nums">
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeQty(l.productId, 1)}
                    aria-label="Increase quantity"
                    className="grid h-9 w-9 place-items-center rounded-full bg-muted hover:bg-muted/70"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(l.productId)}
                  aria-label="Remove item"
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payment
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => {
            const active = m === payment;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setPayment(m)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {PAYMENT_INSTRUCTIONS[m].label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Customer (optional)
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="pos-name">Name</Label>
            <Input
              id="pos-name"
              autoComplete="off"
              placeholder="Walk-in customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pos-phone">Phone</Label>
            <Input
              id="pos-phone"
              autoComplete="off"
              inputMode="tel"
              placeholder="—"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pos-note">Note</Label>
            <Input
              id="pos-note"
              autoComplete="off"
              placeholder="optional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-border bg-background/85 p-3 shadow-popover backdrop-blur-xl">
        <div className="flex items-baseline justify-between px-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatPrice(totals.subtotal)}
          </span>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={submitting || lines.length === 0}
          onClick={submit}
        >
          <Receipt className="h-5 w-5" />
          {submitting ? "Saving…" : "Record sale"}
        </Button>
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
