import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/auth/session";
import { getMyPlanLimits } from "@/lib/billing/capabilities";
import { getUnreadCount } from "@/services/notifications";
import { getStoreSettings } from "@/services/settings";
import { NotificationsRealtime } from "@/components/notifications/notifications-realtime";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireStaff();
  const [unread, settings, limits] = await Promise.all([
    getUnreadCount(),
    getStoreSettings(),
    getMyPlanLimits(),
  ]);

  // Hide nav for capabilities the store's plan doesn't include (the server
  // actions enforce the same gates — this is just honest navigation).
  const hiddenHrefs: string[] = [];
  if (limits && !limits.pos) hiddenHrefs.push("/admin/pos");
  if (limits && !limits.coupons) hiddenHrefs.push("/admin/coupons");

  return (
    <>
      <NotificationsRealtime />
      <AdminShell
        userName={profile.name ?? profile.email ?? "Staff"}
        role={profile.role}
        isAdmin={profile.role === "admin"}
        unreadNotifications={unread}
        businessName={settings.businessName}
        logoUrl={settings.logoUrl}
        hiddenHrefs={hiddenHrefs}
      >
        {children}
      </AdminShell>
    </>
  );
}
