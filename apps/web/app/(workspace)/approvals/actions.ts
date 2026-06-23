"use server";

import { fetchUserNotificationFeed } from "@/lib/approvals/queries";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";

export async function loadNotificationInbox() {
  const { supabase } = await requireTenantMutation();
  return fetchUserNotificationFeed(supabase, { limit: 30 });
}

export async function loadNotificationUnreadCount(): Promise<number> {
  const { supabase } = await requireTenantMutation();
  const feed = await fetchUserNotificationFeed(supabase, { limit: 1 });
  return feed.unread_count;
}

export async function markNotificationsRead(notificationIds: string[] | null) {
  const { supabase } = await requireTenantMutation();
  const { error } = await supabase.rpc("mark_user_notifications_read", {
    p_notification_ids: notificationIds,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true as const };
}
