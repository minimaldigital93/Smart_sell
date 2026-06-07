"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { startStoreAction, type ActionState } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { cn, formatPrice } from "@/lib/utils";

export type SignupPlan = {
  code: string;
  name: string;
  price_usd: number;
  features: string[];
};

const initialState: ActionState = { ok: false };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Creating your store…" : "Continue to payment"}
    </Button>
  );
}

export function StartStoreForm({ plans }: { plans: SignupPlan[] }) {
  const [state, formAction] = useActionState(startStoreAction, initialState);
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Choose your plan</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const active = plan.code === planCode;
            return (
              <label
                key={plan.code}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 transition",
                  active
                    ? "border-primary ring-primary/30 ring-2"
                    : "border-border hover:border-primary/40",
                )}
              >
                <input
                  type="radio"
                  name="planCode"
                  value={plan.code}
                  checked={active}
                  onChange={() => setPlanCode(plan.code)}
                  className="sr-only"
                  required
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{plan.name}</span>
                  {active ? (
                    <Check className="text-primary h-4 w-4" aria-hidden />
                  ) : null}
                </div>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatPrice(plan.price_usd)}
                  <span className="text-muted-foreground text-xs font-normal">
                    /mo
                  </span>
                </p>
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {plan.features.slice(0, 3).map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="businessName">Store name</Label>
        <Input
          id="businessName"
          name="businessName"
          placeholder="Bella Cosmetics"
          required
        />
      </div>
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="012 345 678"
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-muted-foreground mt-1.5 text-xs">
          At least 8 characters.
        </p>
      </div>
      <FieldError message={state.error} />
      <SubmitBtn />
    </form>
  );
}
