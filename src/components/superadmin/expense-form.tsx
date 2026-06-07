"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addExpense, type ExpenseState } from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

const initialState: ExpenseState = { ok: false };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add expense"}
    </Button>
  );
}

export function ExpenseForm() {
  const [state, formAction] = useActionState(addExpense, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-card grid gap-3 rounded-2xl border p-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" placeholder="Vercel Pro, Supabase" required />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
          defaultValue="hosting"
        >
          <option value="hosting">Hosting</option>
          <option value="server">Server</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <Label htmlFor="amount_usd">Amount (USD)</Label>
        <Input
          id="amount_usd"
          name="amount_usd"
          type="number"
          step="0.01"
          min="0"
          placeholder="20.00"
          required
        />
      </div>
      <div>
        <Label htmlFor="incurred_on">Date</Label>
        <Input id="incurred_on" name="incurred_on" type="date" />
      </div>
      <div>
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="Monthly" />
      </div>
      <div className="flex items-end justify-between gap-3 sm:col-span-2">
        <FieldError message={state.error} />
        {state.message ? (
          <p className="text-sm text-emerald-600">{state.message}</p>
        ) : null}
        <SubmitBtn />
      </div>
    </form>
  );
}
