import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types";

export async function listNotifications(limit = 50): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notifications.list]", error);
    return [];
  }
  return data ?? [];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    console.error("[notifications.unread]", error);
    return 0;
  }
  return count ?? 0;
}
