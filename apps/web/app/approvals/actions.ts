"use server";

import { fetchUserNotificationFeed } from "@/lib/approvals/queries";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export async function loadNotificationInbox() {
  const { supabase } = await requireTenantId();
  return fetchUserNotificationFeed(supabase, { limit: 30 });
}

export async function markNotificationsRead(notificationIds: string[] | null) {
  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("mark_user_notifications_read", {
    p_notification_ids: notificationIds,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true as const };
}
