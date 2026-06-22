import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionPlanInterval } from "../types";
import { isMissingTableError } from "./safe-query";

export type SubscriptionPlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_amount: number;
  price_currency: string;
  billing_interval: SubscriptionPlanInterval;
  trial_days: number;
  limits_json: Record<string, unknown>;
  features_json: Record<string, unknown>;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlansResult = {
  rows: SubscriptionPlanRow[];
  total: number;
};

export type SubscriptionPlanFilters = {
  activeOnly?: boolean;
  publicOnly?: boolean;
};

export async function fetchSubscriptionPlans(
  admin: SupabaseClient,
  filters: SubscriptionPlanFilters = {}
): Promise<SubscriptionPlansResult> {
  let query = admin
    .from("subscription_plans")
    .select(
      `
      id,
      code,
      name,
      description,
      price_amount,
      price_currency,
      billing_interval,
      trial_days,
      limits_json,
      features_json,
      is_active,
      is_public,
      sort_order,
      stripe_product_id,
      stripe_price_id,
      created_at,
      updated_at
    `,
      { count: "exact" }
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (filters.activeOnly) query = query.eq("is_active", true);
  if (filters.publicOnly) query = query.eq("is_public", true);

  const { data, count, error } = await query;
  if (isMissingTableError(error)) {
    return { rows: [], total: 0 };
  }
  if (error) throw error;

  const rows: SubscriptionPlanRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    price_amount: Number(row.price_amount ?? 0),
    price_currency: row.price_currency as string,
    billing_interval: row.billing_interval as SubscriptionPlanInterval,
    trial_days: Number(row.trial_days ?? 0),
    limits_json: (row.limits_json as Record<string, unknown> | null) ?? {},
    features_json: (row.features_json as Record<string, unknown> | null) ?? {},
    is_active: Boolean(row.is_active),
    is_public: Boolean(row.is_public),
    sort_order: Number(row.sort_order ?? 0),
    stripe_product_id: (row.stripe_product_id as string | null) ?? null,
    stripe_price_id: (row.stripe_price_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));

  return { rows, total: count ?? rows.length };
}
