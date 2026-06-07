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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  // Scope to the viewer's own feed: their targeted rows + broadcasts. Staff
  // RLS can SELECT every notification in the system, so without this filter
  // the badge counts every customer's unread order updates too.
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null)
    .or(`user_id.eq.${user.id},user_id.is.null`);

  if (error) {
    console.error("[notifications.unread]", error);
    return 0;
  }
  return count ?? 0;
}
