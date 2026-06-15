import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_SALES_DOCUMENT_CONVERSION_MODE,
  parseSalesDocumentConversionMode,
  type SalesDocumentConversionMode,
} from "@/lib/sales/document-conversion-settings";

export type SalesSettings = {
  allow_line_item_discounts: boolean;
  allow_transaction_discounts: boolean;
  selling_prices_tax_inclusive: boolean;
  document_conversion_mode: SalesDocumentConversionMode;
};

const DEFAULT_SALES_SETTINGS: SalesSettings = {
  allow_line_item_discounts: true,
  allow_transaction_discounts: false,
  selling_prices_tax_inclusive: false,
  document_conversion_mode: DEFAULT_SALES_DOCUMENT_CONVERSION_MODE,
};

function readBoolean(
  meta: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  return typeof meta[key] === "boolean" ? meta[key] : fallback;
}

export async function fetchSalesSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SalesSettings> {
  const { data: row } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", "SALES_SETTINGS")
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .maybeSingle();

  const meta =
    row?.configuration_metadata && typeof row.configuration_metadata === "object"
      ? (row.configuration_metadata as Record<string, unknown>)
      : {};

  return {
    allow_line_item_discounts: readBoolean(
      meta,
      "allow_line_item_discounts",
      DEFAULT_SALES_SETTINGS.allow_line_item_discounts
    ),
    allow_transaction_discounts: readBoolean(
      meta,
      "allow_transaction_discounts",
      DEFAULT_SALES_SETTINGS.allow_transaction_discounts
    ),
    selling_prices_tax_inclusive: readBoolean(
      meta,
      "selling_prices_tax_inclusive",
      DEFAULT_SALES_SETTINGS.selling_prices_tax_inclusive
    ),
    document_conversion_mode: parseSalesDocumentConversionMode(meta.document_conversion_mode),
  };
}
