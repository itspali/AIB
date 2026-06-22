import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceDeletionStatus = {
  requestId: string;
  tenantId: string;
  status: "PENDING";
  requestedAt: string;
  scheduledPurgeAt: string;
  graceDays: number;
  backupAcknowledged: boolean;
};

function parseDeletionStatus(raw: unknown): WorkspaceDeletionStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.status !== "PENDING") return null;
  if (typeof row.request_id !== "string") return null;
  if (typeof row.tenant_id !== "string") return null;
  if (typeof row.requested_at !== "string") return null;
  if (typeof row.scheduled_purge_at !== "string") return null;
  if (typeof row.grace_days !== "number") return null;

  return {
    requestId: row.request_id,
    tenantId: row.tenant_id,
    status: "PENDING",
    requestedAt: row.requested_at,
    scheduledPurgeAt: row.scheduled_purge_at,
    graceDays: row.grace_days,
    backupAcknowledged: row.backup_acknowledged === true,
  };
}

export async function fetchWorkspaceDeletionStatus(
  supabase: SupabaseClient,
): Promise<WorkspaceDeletionStatus | null> {
  const { data, error } = await supabase.rpc("get_tenant_workspace_deletion_status");
  if (error) return null;
  return parseDeletionStatus(data);
}

export async function isWorkspaceDeletionPending(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  const status = await fetchWorkspaceDeletionStatus(supabase);
  return status?.tenantId === tenantId && status.status === "PENDING";
}
