import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchActiveSupplierOptions } from "@/lib/entities/queries";
import { parseCatalogItemSettings } from "@/lib/products/catalog-item-settings";
import type { ProductCatalogContext } from "@/lib/products/types";

export async function fetchProductCatalogContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductCatalogContext> {
  const [
    { data: tenant },
    suppliers,
    { data: tags },
    { data: storefronts },
    { data: priceBooks },
    { data: taxCodes },
    { data: uoms },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("base_currency, accounting_config")
      .eq("id", tenantId)
      .maybeSingle(),
    fetchActiveSupplierOptions(supabase, tenantId),
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
      .select("id, name, currency_code")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("tax_codes")
      .select("id, code, name, rate, kind, is_variable")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("uoms")
      .select("id, code, name, family, factor_to_base, is_family_base")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("family")
      .order("factor_to_base"),
  ]);

  const accountingConfig =
    tenant?.accounting_config && typeof tenant.accounting_config === "object"
      ? (tenant.accounting_config as Record<string, unknown>)
      : {};

  const valuationMethod =
    typeof accountingConfig.inventory_valuation_method === "string"
      ? accountingConfig.inventory_valuation_method
      : "FIFO";

  const catalogItems = parseCatalogItemSettings(accountingConfig);

  return {
    base_currency: tenant?.base_currency ?? "USD",
    inventory_valuation_method: valuationMethod,
    runtime_valuation_engine: "LOCATION_SCOPED",
    runtime_valuation_note:
      "Resolved per location (with organization default fallback). MWAC executes when the effective rule is MWAC; FIFO is blocked until cost layers ship.",
    catalog_items: catalogItems,
    suppliers: suppliers.map((row) => ({ id: row.id, name: row.name })),
    tags: (tags ?? []).map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
    storefronts: (storefronts ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      channel_type: row.channel_type,
      slug: row.slug,
    })),
    price_books: (priceBooks ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      currency_code: (row.currency_code as string) ?? "USD",
    })),
    tax_codes: (taxCodes ?? []).map((row) => ({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      rate: Number(row.rate),
      kind: row.kind as string,
      is_variable: Boolean(row.is_variable),
    })),
    uoms: (uoms ?? []).map((row) => ({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      family: row.family as string,
      factor_to_base: Number(row.factor_to_base),
      is_family_base: Boolean(row.is_family_base),
    })),
  };
}
