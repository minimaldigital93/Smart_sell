"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { CouponRow } from "@/services/coupons";
import {
  createCouponAction,
  updateCouponAction,
  type CouponMutationResult,
} from "@/app/actions/coupons";

const initial: CouponMutationResult = { ok: true };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium shadow-sm transition active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(name: string, fd: FormData): string {
  const raw = String(fd.get(name) ?? "");
  if (!raw) return "";
  return new Date(raw).toISOString();
}

export function CouponForm({ coupon }: { coupon?: CouponRow }) {
  const isEdit = Boolean(coupon);
  const boundAction = isEdit
    ? async (prev: CouponMutationResult, fd: FormData) => {
        // Convert datetime-local → ISO before sending.
        const startsAt = fromLocalInput("startsAt", fd);
        const expiresAt = fromLocalInput("expiresAt", fd);
        if (startsAt) fd.set("startsAt", startsAt);
        if (expiresAt) fd.set("expiresAt", expiresAt);
        return updateCouponAction(coupon!.id, prev, fd);
      }
    : async (prev: CouponMutationResult, fd: FormData) => {
        const startsAt = fromLocalInput("startsAt", fd);
        const expiresAt = fromLocalInput("expiresAt", fd);
        if (startsAt) fd.set("startsAt", startsAt);
        if (expiresAt) fd.set("expiresAt", expiresAt);
        return createCouponAction(prev, fd);
      };

  const [state, action] = useActionState(boundAction, initial);

  return (
    <form action={action} className="space-y-5">
      {!state.ok && state.error ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="code" className="mb-1 block text-sm font-medium">
          Code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          defaultValue={coupon?.code ?? ""}
          placeholder="WELCOME10"
          className="border-input bg-background focus:ring-ring h-11 w-full rounded-lg border px-3 font-mono uppercase tracking-wide focus:outline-none focus:ring-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="discountType" className="mb-1 block text-sm font-medium">
            Discount type
          </label>
          <select
            id="discountType"
            name="discountType"
            defaultValue={coupon?.discount_type ?? "percent"}
            className="border-input bg-background h-11 w-full rounded-lg border px-3"
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed ($)</option>
          </select>
        </div>
        <div>
          <label htmlFor="discountValue" className="mb-1 block text-sm font-medium">
            Discount value
          </label>
          <input
            id="discountValue"
            name="discountValue"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={coupon?.discount_value ?? ""}
            className="border-input bg-background h-11 w-full rounded-lg border px-3"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="minSubtotal" className="mb-1 block text-sm font-medium">
            Minimum subtotal
          </label>
          <input
            id="minSubtotal"
            name="minSubtotal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={coupon?.min_subtotal ?? 0}
            className="border-input bg-background h-11 w-full rounded-lg border px-3"
          />
        </div>
        <div>
          <label
            htmlFor="maxRedemptions"
            className="mb-1 block text-sm font-medium"
          >
            Max redemptions
          </label>
          <input
            id="maxRedemptions"
            name="maxRedemptions"
            type="number"
            min="1"
            placeholder="Unlimited"
            defaultValue={coupon?.max_redemptions ?? ""}
            className="border-input bg-background h-11 w-full rounded-lg border px-3"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startsAt" className="mb-1 block text-sm font-medium">
            Starts at
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(coupon?.starts_at ?? null)}
            className="border-input bg-background h-11 w-full rounded-lg border px-3"
          />
        </div>
        <div>
          <label htmlFor="expiresAt" className="mb-1 block text-sm font-medium">
            Expires at
          </label>
          <input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={toLocalInput(coupon?.expires_at ?? null)}
            className="border-input bg-background h-11 w-full rounded-lg border px-3"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={coupon?.is_active ?? true}
          className="h-4 w-4 rounded"
        />
        Active
      </label>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={isEdit ? "Save changes" : "Create coupon"} />
        <Link
          href="/admin/coupons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
