"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePaymentSettingsAction } from "@/app/actions/payments";
import type { MyPaymentSettings } from "@/app/actions/payments";

/**
 * khqr.cc merchant profile for automatic KHQR settlement. The secret is
 * write-only: the server never echoes it back — an existing secret shows as
 * "saved" and an empty input keeps it.
 */
export function PaymentSettingsForm({ initial }: { initial: MyPaymentSettings }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [profileId, setProfileId] = useState(initial.profileId);
  const [secret, setSecret] = useState("");
  const [currency, setCurrency] = useState<"USD" | "KHR">(initial.currency);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await savePaymentSettingsAction({
      enabled,
      profileId,
      secret,
      currency,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Payment settings saved");
    setSecret("");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <QrCode className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-medium">KHQR payments</h2>
          <p className="text-sm text-muted-foreground">
            Connect your khqr.cc merchant profile so customers can pay by KHQR
            and payments settle to your account automatically.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <span className="text-sm font-medium">Accept KHQR payments</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 accent-[var(--primary)]"
          />
        </label>

        <div>
          <Label htmlFor="khqrpay-profile">khqr.cc profile ID</Label>
          <Input
            id="khqrpay-profile"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            placeholder="e.g. 12345"
            autoComplete="off"
          />
        </div>

        <div>
          <Label htmlFor="khqrpay-secret">
            Secret key{" "}
            {initial.hasSecret ? (
              <span className="font-normal text-muted-foreground">
                (saved — leave blank to keep)
              </span>
            ) : null}
          </Label>
          <Input
            id="khqrpay-secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={initial.hasSecret ? "••••••••••••" : "Your khqr.cc secret"}
            autoComplete="new-password"
          />
        </div>

        <div>
          <Label htmlFor="khqrpay-currency">Settlement currency</Label>
          <select
            id="khqrpay-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value === "KHR" ? "KHR" : "USD")}
            className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
          >
            <option value="USD">USD</option>
            <option value="KHR">KHR</option>
          </select>
        </div>

        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save payment settings
        </Button>
      </div>
    </section>
  );
}
