"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/types";
import { CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useFormatPrice } from "@/lib/settings/store-config";
import {
  hardDeleteProductAction,
  restoreProductAction,
} from "@/app/actions/products";

function categoryLabel(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = 44;
const SWIPE_TRIGGER = 8;

export function SwipeableProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);

  const isActive = product.is_active;

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    dragging.current = false;
    moved.current = false;
    setIsDragging(false);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (!dragging.current) {
      if (Math.abs(dx) > SWIPE_TRIGGER && Math.abs(dx) > Math.abs(dy)) {
        dragging.current = true;
        setIsDragging(true);
      } else if (Math.abs(dy) > SWIPE_TRIGGER) {
        startX.current = null;
        startY.current = null;
        return;
      } else {
        return;
      }
    }

    moved.current = true;
    const base = open ? -ACTION_WIDTH : 0;
    let next = base + dx;
    if (next > 0) next = 0;
    if (next < -ACTION_WIDTH - 24) next = -ACTION_WIDTH - 24;
    setOffset(next);
  }

  function onTouchEnd() {
    if (dragging.current) {
      if (offset <= -OPEN_THRESHOLD) {
        setOpen(true);
        setOffset(-ACTION_WIDTH);
      } else {
        setOpen(false);
        setOffset(0);
      }
    }
    startX.current = null;
    startY.current = null;
    dragging.current = false;
    setIsDragging(false);
  }

  function onCardClick(e: React.MouseEvent) {
    if (moved.current || open) {
      e.preventDefault();
      if (open) {
        setOpen(false);
        setOffset(0);
      }
      moved.current = false;
      return;
    }
    router.push(`/admin/products/${product.id}/edit`);
  }

  function onAction() {
    if (isActive) {
      const sure = window.confirm(
        `Permanently delete "${product.name}"? This removes it from the database and cannot be undone. Products with existing orders or stock history cannot be deleted.`,
      );
      if (!sure) {
        setOpen(false);
        setOffset(0);
        return;
      }
    }
    startTransition(async () => {
      const action = isActive ? hardDeleteProductAction : restoreProductAction;
      const result = await action(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Deleted" : "Restored");
      setOpen(false);
      setOffset(0);
      router.refresh();
    });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onAction}
        disabled={pending}
        aria-label={isActive ? "Deactivate product" : "Restore product"}
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center gap-1 px-3 text-xs font-medium text-white",
          isActive ? "bg-destructive" : "bg-success",
          pending && "opacity-70",
        )}
        style={{ width: ACTION_WIDTH }}
      >
        {isActive ? (
          <>
            <Trash2 className="h-5 w-5" />
            <span>Delete</span>
          </>
        ) : (
          <>
            <RotateCcw className="h-5 w-5" />
            <span>Restore</span>
          </>
        )}
      </button>

      <div
        role="button"
        tabIndex={0}
        onClick={onCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/admin/products/${product.id}/edit`);
          }
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: isDragging ? "none" : "transform 200ms ease",
        }}
        className="relative flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft active:bg-muted"
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {categoryLabel(product.category)} · stock {product.stock}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {formatPrice(product.discount_price ?? product.price)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {product.is_active ? (
            <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
              Active
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Hidden
            </span>
          )}
          {product.featured ? (
            <span className="inline-flex rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-500">
              Featured
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
