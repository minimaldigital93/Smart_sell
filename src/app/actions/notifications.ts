"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

export type NotificationActionResult =
  | { ok: true }
  | { ok: false; error: string };

// Scope: a caller can only mark rows they own, or broadcasts (user_id IS NULL)
// that are visible to them. Without this scoping, staff's RLS UPDATE policy
// covers every row and a stray "Mark all read" click would clear unread state
// for every customer in the system.
//
// Broadcasts have a single shared read_at by schema design, so marking one
// read here marks it read for everyone — same as the original behaviour, just
// no longer accidentally extended to targeted customer rows.

export async function markReadAction(
  id: string,
): Promise<NotificationActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .is("read_at", null);
  if (error) {
    console.error("[notifications.markRead]", error);
    return { ok: false, error: "Could not mark as read." };
  }
  revalidatePath("/notifications");
  revalidatePath("/admin/notifications");
  return { ok: true };
}

export async function markAllReadAction(): Promise<NotificationActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .is("read_at", null);
  if (error) {
    console.error("[notifications.markAllRead]", error);
    return { ok: false, error: "Could not mark all as read." };
  }
  revalidatePath("/notifications");
  revalidatePath("/admin/notifications");
  return { ok: true };
}
