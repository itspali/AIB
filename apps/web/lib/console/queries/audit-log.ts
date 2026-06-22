import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConsoleAction } from "../types";
import { isMissingTableError } from "./safe-query";

export type AuditLogFilters = {
  action?: AppConsoleAction;
  operatorId?: string;
  tenantId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type AuditLogRow = {
  id: string;
  operator_id: string;
  operator_email: string;
  action: AppConsoleAction;
  target_type: string;
  target_id: string | null;
  tenant_id: string | null;
  payload: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AuditLogResult = {
  rows: AuditLogRow[];
  total: number;
};

export async function fetchAuditLog(
  admin: SupabaseClient,
  filters: AuditLogFilters = {}
): Promise<AuditLogResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = admin
    .from("app_console_audit_log")
    .select(
      `
      id,
      operator_id,
      operator_email,
      action,
      target_type,
      target_id,
      tenant_id,
      payload,
      ip_address,
      user_agent,
      created_at
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.operatorId) query = query.eq("operator_id", filters.operatorId);
  if (filters.tenantId) query = query.eq("tenant_id", filters.tenantId);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, count, error } = await query;
  if (isMissingTableError(error)) {
    return { rows: [], total: 0 };
  }
  if (error) throw error;

  const rows: AuditLogRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    operator_id: row.operator_id as string,
    operator_email: row.operator_email as string,
    action: row.action as AppConsoleAction,
    target_type: row.target_type as string,
    target_id: (row.target_id as string | null) ?? null,
    tenant_id: (row.tenant_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? {},
    ip_address: (row.ip_address as string | null) ?? null,
    user_agent: (row.user_agent as string | null) ?? null,
    created_at: row.created_at as string,
  }));

  return { rows, total: count ?? rows.length };
}
