"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { THEME_PRESETS } from "@/lib/theme/presets";
import type { StoreSettings } from "@/lib/settings/schema";
import { updateStoreSettingsAction } from "@/app/actions/settings";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "km", label: "ខ្មែរ (Khmer)" },
] as const;

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [theme, setTheme] = useState(settings.theme);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      e.target.value = "";
      return;
    }
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  }

  function clearLogo() {
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("theme", theme);
    formData.set("removeLogo", String(removeLogo));
    startTransition(async () => {
      const result = await updateStoreSettingsAction(formData);
      if (result.ok) {
        toast.success("Settings saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-8">
      {/* Branding */}
      <Section
        title="Branding"
        description="Your shop name and logo appear across the storefront, admin, and invoices."
      >
        <div>
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted">
              {logoPreview ? (
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  width={80}
                  height={80}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                {logoPreview ? "Change logo" : "Upload logo"}
              </Button>
              {logoPreview ? (
                <button
                  type="button"
                  onClick={clearLogo}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              ) : null}
              <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or SVG · max 2 MB</p>
            </div>
          </div>
          <input
            ref={fileRef}
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onPickLogo}
          />
        </div>

        <div>
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={settings.businessName}
            maxLength={60}
            required
            placeholder="e.g. Lumière Beauty"
          />
        </div>

        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            name="tagline"
            defaultValue={settings.tagline}
            maxLength={120}
            placeholder="Short line shown under your name"
          />
        </div>
      </Section>

      {/* Theme */}
      <Section
        title="Theme color"
        description="Pick an accent palette. It updates buttons, highlights, and badges everywhere."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_PRESETS.map((preset) => {
            const active = preset.key === theme;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => setTheme(preset.key)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                  active
                    ? "border-foreground/30 bg-muted shadow-soft"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: preset.swatch }}
                >
                  {active ? <Check className="h-4 w-4 text-white" /> : null}
                </span>
                <span className="text-sm font-medium">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Locale & money */}
      <Section
        title="Language & currency"
        description="The default language for new visitors and how prices are labelled."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="defaultLocale">Default language</Label>
            <select
              id="defaultLocale"
              name="defaultLocale"
              defaultValue={settings.defaultLocale}
              className="flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-[15px] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="currency">Currency code</Label>
            <Input
              id="currency"
              name="currency"
              defaultValue={settings.currency}
              maxLength={8}
              placeholder="USD"
            />
          </div>
        </div>
        <div className="sm:max-w-[12rem]">
          <Label htmlFor="shippingFee">Default shipping fee</Label>
          <Input
            id="shippingFee"
            name="shippingFee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={settings.shippingFee}
          />
        </div>
      </Section>

      {/* Contact */}
      <Section
        title="Contact details"
        description="Shown on invoices and order confirmations. Optional."
      >
        <div>
          <Label htmlFor="contactPhone">Phone</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            defaultValue={settings.contactPhone ?? ""}
            maxLength={40}
            placeholder="+855 ..."
          />
        </div>
        <div>
          <Label htmlFor="contactAddress">Address</Label>
          <Input
            id="contactAddress"
            name="contactAddress"
            defaultValue={settings.contactAddress ?? ""}
            maxLength={200}
            placeholder="Shop address"
          />
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur md:bottom-0">
        <Button type="submit" size="md" disabled={pending} className="w-full sm:w-auto">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
