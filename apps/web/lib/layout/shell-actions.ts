"use server";

import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export async function fetchApprovalAlertCountAction(): Promise<number> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchApprovalAlertCount(supabase, tenantId);
}
