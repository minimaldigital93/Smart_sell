"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetRequestAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

const initialState: ActionState = { ok: false };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export function ResetForm() {
  const [state, formAction] = useActionState(resetRequestAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>
      <FieldError message={state.error} />
      {state.message ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          {state.message}
        </p>
      ) : null}
      <SubmitBtn />
    </form>
  );
}
