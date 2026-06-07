import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/auth/session";
import { getUnreadCount } from "@/services/notifications";
import { getStoreSettings } from "@/services/settings";
import { NotificationsRealtime } from "@/components/notifications/notifications-realtime";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireStaff();
  const [unread, settings] = await Promise.all([
    getUnreadCount(),
    getStoreSettings(),
  ]);
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
      >
        {children}
      </AdminShell>
    </>
  );
}
