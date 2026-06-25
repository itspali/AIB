export type ImportReceiptDocumentStrategy =
  | "SINGLE_GRN_WITH_STAGES"
  | "SEPARATE_GRNS_PER_STAGE"
  | "SINGLE_FINAL_ONLY";

export type ImportReceiptMode =
  | "DIRECT_TO_WAREHOUSE"
  | "STAGING_THEN_GIT"
  | "STAGING_THEN_TRANSFER";

export type PoFulfillmentStage = "COMMERCIAL" | "FINAL";

export type RequireBoeOnFirstReceipt = "ALWAYS" | "NEVER" | "ON_FINAL_RECEIPT_ONLY";

export type ImportLogisticsSettings = {
  /** Master switch — import modules, settings, and GIT surfaces are hidden when false. */
  imports_enabled: boolean;
  import_receipt_document_strategy: ImportReceiptDocumentStrategy;
  import_receipt_mode: ImportReceiptMode;
  po_fulfillment_stage: PoFulfillmentStage;
  require_boe_on_first_receipt: RequireBoeOnFirstReceipt;
  allow_staging_receipt_location_mismatch: boolean;
  allow_commercial_receipt_before_customs: boolean;
  git_enabled: boolean;
};

export const DEFAULT_IMPORT_LOGISTICS_SETTINGS: ImportLogisticsSettings = {
  imports_enabled: false,
  import_receipt_document_strategy: "SINGLE_FINAL_ONLY",
  import_receipt_mode: "DIRECT_TO_WAREHOUSE",
  po_fulfillment_stage: "COMMERCIAL",
  require_boe_on_first_receipt: "ALWAYS",
  allow_staging_receipt_location_mismatch: false,
  allow_commercial_receipt_before_customs: false,
  git_enabled: true,
};
