import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TenantAccountStatus,
  TenantOnboardingSource,
  TenantOnboardingStatus,
  TenantSubscriptionStatus,
} from "../types";
import { isMissingTableError, safeTenantHeadCount } from "./safe-query";

export type TenantDetailUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type TenantDetailHealth = {
  items: number;
  entities: number;
  purchase_orders: number;
};

export type TenantDetailSubscription = {
  id: string;
  status: TenantSubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    billing_interval: string;
    price_amount: number;
    price_currency: string;
  } | null;
};

export type TenantDetail = {
  tenant: {
    id: string;
    organization_code: string;
    name: string;
    legal_name: string | null;
    trade_name: string | null;
    primary_email: string;
    primary_phone: string;
    status: TenantAccountStatus;
    is_active: boolean;
    onboarding_status: TenantOnboardingStatus;
    onboarding_source: TenantOnboardingSource;
    country_code: string | null;
    timezone: string;
    locale: string;
    group_id: string | null;
    created_at: string;
    created_by_user_id: string | null;
    metadata_json: Record<string, unknown>;
  };
  users: TenantDetailUser[];
  location_count: number;
  health: TenantDetailHealth;
  subscription: TenantDetailSubscription | null;
};

export async function fetchTenantDetail(
  admin: SupabaseClient,
  tenantId: string
): Promise<TenantDetail | null> {
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select(
      `
      id,
      organization_code,
      name,
      legal_name,
      trade_name,
      primary_email,
      primary_phone,
      status,
      is_active,
      onboarding_status,
      onboarding_source,
      country_code,
      timezone,
      locale,
      group_id,
      created_at,
      created_by_user_id,
      metadata_json
    `
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  if (!tenant) return null;

  const [usersResult, locationCount, items, entities, purchaseOrders, subscription] =
    await Promise.all([
      admin
        .from("users")
        .select(
          "id, email, first_name, last_name, role, is_active, last_login_at, created_at"
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true }),
      safeTenantHeadCount(admin, "tenant_locations", tenantId),
      safeTenantHeadCount(admin, "items", tenantId),
      safeTenantHeadCount(admin, "entities", tenantId),
      safeTenantHeadCount(admin, "purchase_orders", tenantId),
      fetchTenantSubscription(admin, tenantId),
    ]);

  if (usersResult.error) throw usersResult.error;

  return {
    tenant: {
      ...tenant,
      metadata_json: (tenant.metadata_json as Record<string, unknown> | null) ?? {},
    } as TenantDetail["tenant"],
    users: (usersResult.data ?? []) as TenantDetailUser[],
    location_count: locationCount,
    health: {
      items,
      entities,
      purchase_orders: purchaseOrders,
    },
    subscription,
  };
}

async function fetchTenantSubscription(
  admin: SupabaseClient,
  tenantId: string
): Promise<TenantDetailSubscription | null> {
  const { data, error } = await admin
    .from("tenant_subscriptions")
    .select(
      `
      id,
      status,
      trial_started_at,
      trial_ends_at,
      current_period_start,
      current_period_end,
      canceled_at,
      stripe_customer_id,
      stripe_subscription_id,
      plan:subscription_plans (
        id,
        code,
        name,
        billing_interval,
        price_amount,
        price_currency
      )
    `
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (isMissingTableError(error) || error) return null;
  if (!data) return null;

  const planRaw = data.plan as TenantDetailSubscription["plan"] | TenantDetailSubscription["plan"][];
  const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw;

  return {
    id: data.id as string,
    status: data.status as TenantSubscriptionStatus,
    trial_started_at: (data.trial_started_at as string | null) ?? null,
    trial_ends_at: (data.trial_ends_at as string | null) ?? null,
    current_period_start: (data.current_period_start as string | null) ?? null,
    current_period_end: (data.current_period_end as string | null) ?? null,
    canceled_at: (data.canceled_at as string | null) ?? null,
    stripe_customer_id: (data.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id: (data.stripe_subscription_id as string | null) ?? null,
    plan,
  };
}
