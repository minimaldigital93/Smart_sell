import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/services/notifications";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { EnablePushButton } from "@/components/notifications/enable-push-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser("/notifications");
  const notifications = await listNotifications(50);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      </header>
      <EnablePushButton />
      <NotificationsList notifications={notifications} />
    </div>
  );
}
