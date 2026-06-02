import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadCount } from "@/services/notifications";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationsRealtime } from "@/components/notifications/notifications-realtime";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export function ShopTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background safe-pt">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Suspense fallback={null}>
            <UserSlot />
          </Suspense>
          <Link
            href="/search"
            aria-label="Search products"
            className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

async function UserSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  const unread = await getUnreadCount();
  return (
    <>
      <NotificationsRealtime />
      <NotificationBell href="/notifications" unreadCount={unread} />
    </>
  );
}
