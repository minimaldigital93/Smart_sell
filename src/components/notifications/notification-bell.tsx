import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationBell({
  href,
  unreadCount = 0,
  className,
}: {
  href: string;
  unreadCount?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span
          className="absolute -top-0.5 -right-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
          aria-hidden
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
