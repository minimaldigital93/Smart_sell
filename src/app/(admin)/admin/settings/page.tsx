import { requireAdmin } from "@/lib/auth/session";
import { getStoreSettings } from "@/services/settings";
import { SettingsForm } from "@/components/admin/settings/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  // Settings are admin-only to edit (staff can see the rest of admin).
  await requireAdmin();
  const settings = await getStoreSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Customize your store&apos;s branding, theme, and defaults.
        </p>
      </header>
      <SettingsForm settings={settings} />
    </div>
  );
}
