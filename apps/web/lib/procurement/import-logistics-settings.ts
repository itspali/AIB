import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_IMPORT_LOGISTICS_SETTINGS,
  type ImportLogisticsSettings,
  type ImportReceiptDocumentStrategy,
  type ImportReceiptMode,
  type PoFulfillmentStage,
  type RequireBoeOnFirstReceipt,
} from "@/lib/procurement/import-logistics-settings-shared";

export type {
  ImportLogisticsSettings,
  ImportReceiptDocumentStrategy,
  ImportReceiptMode,
  PoFulfillmentStage,
  RequireBoeOnFirstReceipt,
} from "@/lib/procurement/import-logistics-settings-shared";

export { DEFAULT_IMPORT_LOGISTICS_SETTINGS } from "@/lib/procurement/import-logistics-settings-shared";

function readStrategy(value: unknown): ImportReceiptDocumentStrategy {
  if (
    value === "SINGLE_GRN_WITH_STAGES" ||
    value === "SEPARATE_GRNS_PER_STAGE" ||
    value === "SINGLE_FINAL_ONLY"
  ) {
    return value;
  }
  return DEFAULT_IMPORT_LOGISTICS_SETTINGS.import_receipt_document_strategy;
}

function readMode(value: unknown): ImportReceiptMode {
  if (
    value === "DIRECT_TO_WAREHOUSE" ||
    value === "STAGING_THEN_GIT" ||
    value === "STAGING_THEN_TRANSFER"
  ) {
    return value;
  }
  return DEFAULT_IMPORT_LOGISTICS_SETTINGS.import_receipt_mode;
}

function readPoFulfillmentStage(value: unknown): PoFulfillmentStage {
  return value === "FINAL" ? "FINAL" : "COMMERCIAL";
}

function readBoePolicy(value: unknown): RequireBoeOnFirstReceipt {
  if (value === "NEVER" || value === "ON_FINAL_RECEIPT_ONLY") return value;
  return "ALWAYS";
}

export async function fetchImportLogisticsSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ImportLogisticsSettings> {
  const { data: row } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", "IMPORT_LOGISTICS_SETTINGS")
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .maybeSingle();

  const meta =
    row?.configuration_metadata && typeof row.configuration_metadata === "object"
      ? (row.configuration_metadata as Record<string, unknown>)
      : {};

  return {
    imports_enabled:
      typeof meta.imports_enabled === "boolean"
        ? meta.imports_enabled
        : DEFAULT_IMPORT_LOGISTICS_SETTINGS.imports_enabled,
    import_receipt_document_strategy: readStrategy(meta.import_receipt_document_strategy),
    import_receipt_mode: readMode(meta.import_receipt_mode),
    po_fulfillment_stage: readPoFulfillmentStage(meta.po_fulfillment_stage),
    require_boe_on_first_receipt: readBoePolicy(meta.require_boe_on_first_receipt),
    allow_staging_receipt_location_mismatch:
      typeof meta.allow_staging_receipt_location_mismatch === "boolean"
        ? meta.allow_staging_receipt_location_mismatch
        : DEFAULT_IMPORT_LOGISTICS_SETTINGS.allow_staging_receipt_location_mismatch,
    allow_commercial_receipt_before_customs:
      typeof meta.allow_commercial_receipt_before_customs === "boolean"
        ? meta.allow_commercial_receipt_before_customs
        : DEFAULT_IMPORT_LOGISTICS_SETTINGS.allow_commercial_receipt_before_customs,
    git_enabled:
      typeof meta.git_enabled === "boolean"
        ? meta.git_enabled
        : DEFAULT_IMPORT_LOGISTICS_SETTINGS.git_enabled,
  };
}
