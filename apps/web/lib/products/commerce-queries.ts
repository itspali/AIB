import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductCatalogContext } from "@/lib/products/types";

export async function fetchProductCatalogContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductCatalogContext> {
  const [{ data: tenant }, { data: suppliers }] = await Promise.all([
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
  };
}
