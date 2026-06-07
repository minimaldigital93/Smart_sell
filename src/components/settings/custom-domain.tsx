"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  setCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
  DOMAIN_CNAME_TARGET,
  type DomainState,
} from "@/app/actions/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

const initialState: DomainState = { ok: false };

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save domain"}
    </Button>
  );
}

export function CustomDomain({
  domain,
  verified,
}: {
  domain: string | null;
  verified: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(setCustomDomain, initialState);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const verify = () =>
    start(async () => {
      setMsg(null);
      setErr(null);
      const res = await verifyCustomDomain();
      if (res.ok) {
        setMsg(res.message ?? "Verified");
        router.refresh();
      } else setErr(res.error ?? "Verification failed");
    });

  const remove = () =>
    start(async () => {
      setMsg(null);
      setErr(null);
      const res = await removeCustomDomain();
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Could not remove");
    });

  return (
    <div className="bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Custom domain</h2>
        <p className="text-muted-foreground text-sm">
          Point your own domain at your storefront (Pro plan).
        </p>
      </div>

      {domain ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{domain}</p>
            <span
              className={`text-xs font-medium ${verified ? "text-emerald-600" : "text-amber-600"}`}
            >
              {verified ? "Verified" : "Pending verification"}
            </span>
          </div>
          <div className="flex gap-2">
            {!verified ? (
              <Button onClick={verify} disabled={pending} variant="outline">
                {pending ? "Checking…" : "Verify"}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <Label htmlFor="domain">Domain</Label>
          <div className="flex gap-2">
            <Input
              id="domain"
              name="domain"
              placeholder="shop.example.com"
              className="flex-1"
              required
            />
            <SaveBtn />
          </div>
          <FieldError message={state.error} />
        </form>
      )}

      {domain && !verified ? (
        <div className="bg-muted/40 rounded-xl p-3 text-sm">
          <p className="font-medium">Add this DNS record:</p>
          <pre className="text-muted-foreground mt-1 overflow-x-auto text-xs">
            CNAME {domain} → {DOMAIN_CNAME_TARGET}
          </pre>
          <p className="text-muted-foreground mt-1 text-xs">
            Also add the domain to the hosting project. SSL is issued
            automatically once DNS resolves.
          </p>
        </div>
      ) : null}

      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-destructive text-sm">{err}</p> : null}
      {state.message ? (
        <p className="text-sm text-emerald-600">{state.message}</p>
      ) : null}
    </div>
  );
}
