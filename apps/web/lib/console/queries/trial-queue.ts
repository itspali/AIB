import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantAccountStatus, TenantSubscriptionStatus } from "../types";
import { isMissingTableError } from "./safe-query";

export type TrialQueueView = "active" | "expiring_7d" | "expired";

export type TrialQueueFilters = {
  view?: TrialQueueView;
  limit?: number;
  offset?: number;
};

export type TrialQueueRow = {
  subscription_id: string;
  tenant_id: string;
  organization_code: string;
  tenant_name: string;
  tenant_status: TenantAccountStatus;
  subscription_status: TenantSubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  days_remaining: number | null;
  plan_code: string;
  plan_name: string;
};

export type TrialQueueResult = {
  rows: TrialQueueRow[];
  total: number;
};

type TrialJoinRow = {
  id: string;
  tenant_id: string;
  status: TenantSubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  tenant:
    | {
        organization_code: string;
        name: string;
        status: TenantAccountStatus;
      }
    | {
        organization_code: string;
        name: string;
        status: TenantAccountStatus;
      }[]
    | null;
  plan:
    | { code: string; name: string }
    | { code: string; name: string }[]
    | null;
};

function resolveJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function daysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function fetchTrialQueue(
  admin: SupabaseClient,
  filters: TrialQueueFilters = {}
): Promise<TrialQueueResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const view = filters.view ?? "active";
  const now = new Date().toISOString();
  const in7d = new Date();
  in7d.setUTCDate(in7d.getUTCDate() + 7);

  let query = admin
    .from("tenant_subscriptions")
    .select(
      `
      id,
      tenant_id,
      status,
      trial_started_at,
      trial_ends_at,
      tenant:tenants (
        organization_code,
        name,
        status
      ),
      plan:subscription_plans (
        code,
        name
      )
    `,
      { count: "exact" }
    )
    .eq("status", "TRIALING")
    .order("trial_ends_at", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (view === "expiring_7d") {
    query = query.gte("trial_ends_at", now).lte("trial_ends_at", in7d.toISOString());
  } else if (view === "expired") {
    query = query.lt("trial_ends_at", now);
  } else {
    query = query.gte("trial_ends_at", now);
  }

  const { data, count, error } = await query;
  if (isMissingTableError(error)) {
    return { rows: [], total: 0 };
  }
  if (error) throw error;

  const rows: TrialQueueRow[] = ((data ?? []) as TrialJoinRow[]).map((row) => {
    const tenant = resolveJoinRow(row.tenant);
    const plan = resolveJoinRow(row.plan);
    return {
      subscription_id: row.id,
      tenant_id: row.tenant_id,
      organization_code: tenant?.organization_code ?? "",
      tenant_name: tenant?.name ?? "",
      tenant_status: tenant?.status ?? "TRIAL",
      subscription_status: row.status,
      trial_started_at: row.trial_started_at,
      trial_ends_at: row.trial_ends_at,
      days_remaining: daysRemaining(row.trial_ends_at),
      plan_code: plan?.code ?? "",
      plan_name: plan?.name ?? "",
    };
  });

  return { rows, total: count ?? rows.length };
}
