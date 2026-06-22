import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConsoleAction, ConsoleOperator } from "./types";

export type AuditInput = {
  admin: SupabaseClient;
  operator: ConsoleOperator;
  action: AppConsoleAction;
  targetType: string;
  targetId?: string;
  tenantId?: string;
  payload?: Record<string, unknown>;
};

export async function logConsoleAction(input: AuditInput): Promise<void> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip");
  const userAgent = headerStore.get("user-agent");

  const { error } = await input.admin.from("app_console_audit_log").insert({
    operator_id: input.operator.id,
    operator_email: input.operator.email,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    tenant_id: input.tenantId ?? null,
    payload: input.payload ?? {},
    ip_address: ip ?? null,
    user_agent: userAgent,
  });

  if (error) throw error;
}
