import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncTenantAccessFromSubscription(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: sub } = await admin
    .from("tenant_subscriptions")
    .select("status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!sub) return;

  const statusMap: Record<string, { status: string; is_active: boolean }> = {
    TRIALING: { status: "TRIAL", is_active: true },
    ACTIVE: { status: "ACTIVE", is_active: true },
    PAST_DUE: { status: "PAST_DUE", is_active: true },
    CANCELED: { status: "SUSPENDED", is_active: false },
    EXPIRED: { status: "SUSPENDED", is_active: false },
  };

  const mapped = statusMap[sub.status as string];
  if (!mapped) return;

  await admin.from("tenants").update(mapped).eq("id", tenantId);
}
