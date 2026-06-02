"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Status = "unsupported" | "granted" | "denied" | "default";

export function EnablePushButton() {
  const [status, setStatus] = useState<Status>("unsupported");

  useEffect(() => {
    // Sync browser-only API state on mount. The lint rule discourages
    // setState in effects but hydration-safe mirroring of platform state
    // is the standard pattern for SSR'd client components.
    const next: Status =
      typeof window === "undefined" || !("Notification" in window)
        ? "unsupported"
        : Notification.permission;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(next);
  }, []);

  if (status === "unsupported") return null;
  if (status === "granted") {
    return (
      <p className="rounded-2xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        Browser notifications are on. Close the tab and we’ll still buzz you
        while the browser is running.
      </p>
    );
  }

  const denied = status === "denied";

  async function enable() {
    try {
      const result = await Notification.requestPermission();
      setStatus(result);
      if (result === "granted") {
        toast.success("Notifications enabled");
        new Notification("All set", {
          body: "You'll get a buzz when something happens.",
          icon: "/icons/icon-192.png",
        });
      } else {
        toast.error("Permission denied. Enable in your browser settings.");
      }
    } catch {
      toast.error("Could not enable notifications.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-sm font-medium">Enable browser notifications</p>
      <p className="text-xs text-muted-foreground">
        Get a buzz when new orders come in or stock drops.
      </p>
      <Button
        type="button"
        size="md"
        onClick={enable}
        disabled={denied}
        className="mt-1 self-start"
      >
        <BellRing className="h-4 w-4" />
        {denied ? "Blocked — change in browser settings" : "Enable"}
      </Button>
    </div>
  );
}
