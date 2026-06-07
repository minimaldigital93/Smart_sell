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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Customize your store&apos;s branding, theme, and defaults.
        </p>
      </header>
      <SettingsForm settings={settings} />
      <CustomDomain
        domain={store?.custom_domain ?? null}
        verified={store?.domain_verified ?? false}
      />
    </div>
  );
}
