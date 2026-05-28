import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductCatalogContext } from "@/lib/products/types";

export async function fetchProductCatalogContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductCatalogContext> {
  const [
    { data: tenant },
    { data: suppliers },
    { data: tags },
    { data: storefronts },
    { data: priceBooks },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("base_currency, accounting_config")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("entities")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("type", ["SUPPLIER", "MUTUAL_PARTNER"])
      .order("name"),
    supabase
      .from("tags")
      .select("id, name, slug")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("storefront_channels")
      .select("id, name, channel_type, slug")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("price_books")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
  ]);

  const accountingConfig =
    tenant?.accounting_config && typeof tenant.accounting_config === "object"
      ? (tenant.accounting_config as Record<string, unknown>)
      : {};

  const valuationMethod =
    typeof accountingConfig.inventory_valuation_method === "string"
      ? accountingConfig.inventory_valuation_method
      : "FIFO";

  return {
    base_currency: tenant?.base_currency ?? "USD",
    inventory_valuation_method: valuationMethod,
    runtime_valuation_engine: "MWAC",
    suppliers: (suppliers ?? []).map((row) => ({ id: row.id, name: row.name })),
    tags: (tags ?? []).map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
    storefronts: (storefronts ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      channel_type: row.channel_type,
      slug: row.slug,
    })),
    price_books: (priceBooks ?? []).map((row) => ({ id: row.id, name: row.name })),
  };
}
