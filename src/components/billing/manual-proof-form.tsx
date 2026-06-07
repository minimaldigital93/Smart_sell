"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  submitManualSubscriptionProof,
  type ManualProofState,
} from "@/app/actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

const initialState: ManualProofState = { ok: false };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit payment proof"}
    </Button>
  );
}

export function ManualProofForm({ planCode }: { planCode: string }) {
  const [state, formAction] = useActionState(
    submitManualSubscriptionProof,
    initialState,
  );

  if (state.ok) {
    return (
      <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="planCode" value={planCode} />
      <div>
        <Label htmlFor="proof">Payment screenshot</Label>
        <input
          id="proof"
          name="proof"
          type="file"
          accept="image/*"
          required
          className="border-input mt-1 w-full rounded-xl border p-2 text-sm"
        />
        <p className="text-muted-foreground mt-1.5 text-xs">
          Pay by KHQR/bank transfer, then upload the receipt. We&rsquo;ll activate
          your plan once confirmed.
        </p>
      </div>
      <FieldError message={state.error} />
      <SubmitBtn />
    </form>
  );
}
