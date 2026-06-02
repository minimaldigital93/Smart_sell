import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/auth/session";
import { getUnreadCount } from "@/services/notifications";
import { NotificationsRealtime } from "@/components/notifications/notifications-realtime";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireStaff();
  const unread = await getUnreadCount();
  return (
    <>
      <NotificationsRealtime />
      <AdminShell
        userName={profile.name ?? profile.email ?? "Staff"}
        role={profile.role}
        unreadNotifications={unread}
      >
        {children}
      </AdminShell>
    </>
  );
}
