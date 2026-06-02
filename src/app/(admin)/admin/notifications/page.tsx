import { listNotifications } from "@/services/notifications";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { EnablePushButton } from "@/components/notifications/enable-push-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin notifications" };

export default async function AdminNotificationsPage() {
  const notifications = await listNotifications(80);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order, inventory, and system alerts.
        </p>
      </header>
      <EnablePushButton />
      <NotificationsList notifications={notifications} />
    </div>
  );
}
