"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCouponAction } from "@/app/actions/coupons";

export function DeleteCouponButton({ id, code }: { id: string; code: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Delete ${code}`}
      onClick={() => {
        if (!confirm(`Delete coupon ${code}? This cannot be undone.`)) return;
        start(async () => {
          const res = await deleteCouponAction(id);
          if (!res.ok) toast.error(res.error);
          else toast.success(`Deleted ${code}`);
        });
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
