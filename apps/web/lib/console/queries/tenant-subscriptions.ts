import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantAccountStatus, TenantSubscriptionStatus } from "../types";
import { isMissingTableError } from "./safe-query";

export type TenantSubscriptionFilters = {
  status?: TenantSubscriptionStatus;
  planId?: string;
  trialExpiringWithinDays?: number;
  search?: string;
  limit?: number;
  offset?: number;
};

export type TenantSubscriptionRow = {
  id: string;
  tenant_id: string;
  organization_code: string;
  tenant_name: string;
  tenant_status: TenantAccountStatus;
  subscription_status: TenantSubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan_code: string;
  plan_name: string;
  price_amount: number;
  price_currency: string;
  stripe_customer_id: string | null;
  created_at: string;
};

export type TenantSubscriptionsResult = {
  rows: TenantSubscriptionRow[];
  total: number;
};

type SubscriptionJoinRow = {
  id: string;
  tenant_id: string;
  status: TenantSubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  created_at: string;
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
    | {
        code: string;
        name: string;
        price_amount: number;
        price_currency: string;
      }
    | {
        code: string;
        name: string;
        price_amount: number;
        price_currency: string;
      }[]
    | null;
};

function resolveJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function fetchTenantSubscriptions(
  admin: SupabaseClient,
  filters: TenantSubscriptionFilters = {}
): Promise<TenantSubscriptionsResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = admin
    .from("tenant_subscriptions")
    .select(
      `
      id,
      tenant_id,
      status,
      trial_ends_at,
      current_period_end,
      stripe_customer_id,
      created_at,
      tenant:tenants (
        organization_code,
        name,
        status
      ),
      plan:subscription_plans (
        code,
        name,
        price_amount,
        price_currency
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.planId) query = query.eq("plan_id", filters.planId);

  if (filters.trialExpiringWithinDays != null) {
    const now = new Date().toISOString();
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + filters.trialExpiringWithinDays);
    query = query
      .eq("status", "TRIALING")
      .gte("trial_ends_at", now)
      .lte("trial_ends_at", end.toISOString());
  }

  const { data, count, error } = await query;
  if (isMissingTableError(error)) {
    return { rows: [], total: 0 };
  }
  if (error) throw error;

  let rows: TenantSubscriptionRow[] = ((data ?? []) as SubscriptionJoinRow[]).map((row) => {
    const tenant = resolveJoinRow(row.tenant);
    const plan = resolveJoinRow(row.plan);
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      organization_code: tenant?.organization_code ?? "",
      tenant_name: tenant?.name ?? "",
      tenant_status: tenant?.status ?? "TRIAL",
      subscription_status: row.status,
      trial_ends_at: row.trial_ends_at,
      current_period_end: row.current_period_end,
      plan_code: plan?.code ?? "",
      plan_name: plan?.name ?? "",
      price_amount: Number(plan?.price_amount ?? 0),
      price_currency: plan?.price_currency ?? "USD",
      stripe_customer_id: row.stripe_customer_id,
      created_at: row.created_at,
    };
  });

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.tenant_name.toLowerCase().includes(search) ||
        row.organization_code.toLowerCase().includes(search) ||
        row.plan_name.toLowerCase().includes(search) ||
        row.plan_code.toLowerCase().includes(search)
    );
  }

  return { rows, total: search ? rows.length : (count ?? rows.length) };
}
