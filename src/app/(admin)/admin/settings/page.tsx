import Link from "next/link";
import { ChevronRight, Tags } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getStoreSettings } from "@/services/settings";
import { getMyStore } from "@/services/stores";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { CustomDomain } from "@/components/settings/custom-domain";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  // Settings are admin-only to edit (staff can see the rest of admin).
  await requireAdmin();
  const [settings, store] = await Promise.all([getStoreSettings(), getMyStore()]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Customize your store&apos;s branding, theme, and defaults.
        </p>
      </header>
      <SettingsForm settings={settings} />

      <Link
        href="/admin/settings/categories"
        className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:bg-muted/40"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Tags className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Shop Categories</span>
          <span className="block text-sm text-muted-foreground">
            Create and manage the product categories used across your store.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <CustomDomain
        domain={store?.custom_domain ?? null}
        verified={store?.domain_verified ?? false}
      />
    </div>
  );
}
