import type {
  ImportLogisticsSettings,
  PoFulfillmentStage,
  RequireBoeOnFirstReceipt,
} from "@/lib/procurement/import-logistics-settings-shared";

export type GrnReceiptStage = "COMMERCIAL" | "CUSTOMS" | "FINAL" | "GIT_CLEARANCE";

export type GrnPoReceiptContext = {
  id: string;
  tax_supply_nature: string;
  destination_location_id: string;
  receipt_location_id?: string | null;
  ultimate_destination_location_id?: string | null;
  po_fulfillment_stage_override?: PoFulfillmentStage | null;
};

export type GrnShipmentReceiptContext = {
  id: string;
  staging_location_id?: string | null;
  ultimate_destination_location_id?: string | null;
  bill_of_entry_number?: string | null;
  bill_of_entry_date?: string | null;
  port_code?: string | null;
  exchange_rate?: string | null;
  assessable_value?: string | null;
  customs_duty_amount?: string | null;
  import_igst_amount?: string | null;
};

export type GrnReceiptContext = {
  receiptStage: GrnReceiptStage;
  isPoFulfilling: boolean;
  allowedStages: GrnReceiptStage[];
  showStageSelector: boolean;
  requireBoe: boolean;
  boeEditable: boolean;
  defaultDestinationLocationId: string | null;
  stagingLocationId: string | null;
  showGitLink: boolean;
  useAtomicGitClearance: boolean;
};

function resolvePoFulfillmentStage(
  tenantSettings: ImportLogisticsSettings,
  po: GrnPoReceiptContext | null
): PoFulfillmentStage {
  return po?.po_fulfillment_stage_override ?? tenantSettings.po_fulfillment_stage;
}

function stageIsPoFulfilling(
  stage: GrnReceiptStage,
  fulfillmentStage: PoFulfillmentStage
): boolean {
  if (stage === "GIT_CLEARANCE" || stage === "CUSTOMS") return false;
  if (stage === "COMMERCIAL") return fulfillmentStage === "COMMERCIAL";
  if (stage === "FINAL") return fulfillmentStage === "FINAL";
  return false;
}

function resolveAllowedStages(settings: ImportLogisticsSettings): GrnReceiptStage[] {
  if (!settings.imports_enabled) {
    return ["FINAL"];
  }
  if (settings.import_receipt_document_strategy === "SINGLE_FINAL_ONLY") {
    return ["FINAL"];
  }
  if (settings.import_receipt_mode === "STAGING_THEN_GIT") {
    return ["COMMERCIAL", "CUSTOMS", "FINAL", "GIT_CLEARANCE"];
  }
  if (settings.import_receipt_mode === "STAGING_THEN_TRANSFER") {
    return ["COMMERCIAL", "CUSTOMS", "FINAL"];
  }
  return ["COMMERCIAL", "CUSTOMS", "FINAL"];
}

function resolveDefaultStage(
  settings: ImportLogisticsSettings,
  allowedStages: GrnReceiptStage[],
  hasGitVoucher: boolean
): GrnReceiptStage {
  if (hasGitVoucher && allowedStages.includes("GIT_CLEARANCE")) return "GIT_CLEARANCE";
  if (allowedStages.includes("FINAL") && settings.import_receipt_document_strategy === "SINGLE_FINAL_ONLY") {
    return "FINAL";
  }
  if (allowedStages.includes("COMMERCIAL") && settings.import_receipt_mode !== "DIRECT_TO_WAREHOUSE") {
    return "COMMERCIAL";
  }
  return allowedStages[0] ?? "FINAL";
}

export function resolveBoeRequirement(
  stage: GrnReceiptStage,
  taxSupplyNature: string | null | undefined,
  requireBoePolicy: RequireBoeOnFirstReceipt,
  allowCommercialBeforeCustoms: boolean
): boolean {
  if (taxSupplyNature !== "IMPORT_GOODS" || stage === "GIT_CLEARANCE") return false;
  if (stage === "COMMERCIAL") {
    return requireBoePolicy === "ALWAYS" && !allowCommercialBeforeCustoms;
  }
  if (stage === "FINAL") {
    return requireBoePolicy === "ALWAYS" || requireBoePolicy === "ON_FINAL_RECEIPT_ONLY";
  }
  if (stage === "CUSTOMS") {
    return requireBoePolicy === "ALWAYS";
  }
  return false;
}

export function resolveGrnReceiptContext(
  tenantSettings: ImportLogisticsSettings,
  po: GrnPoReceiptContext | null,
  shipment: GrnShipmentReceiptContext | null,
  options?: {
    receiptStage?: GrnReceiptStage | null;
    hasGitVoucher?: boolean;
  }
): GrnReceiptContext {
  const allowedStages = resolveAllowedStages(tenantSettings);
  const hasGitVoucher = options?.hasGitVoucher ?? false;
  const receiptStage =
    options?.receiptStage && allowedStages.includes(options.receiptStage)
      ? options.receiptStage
      : resolveDefaultStage(tenantSettings, allowedStages, hasGitVoucher);

  const fulfillmentStage = resolvePoFulfillmentStage(tenantSettings, po);
  const isPoFulfilling = stageIsPoFulfilling(receiptStage, fulfillmentStage);

  const defaultDestinationLocationId =
    receiptStage === "GIT_CLEARANCE"
      ? shipment?.ultimate_destination_location_id ??
        po?.ultimate_destination_location_id ??
        po?.destination_location_id ??
        null
      : shipment?.staging_location_id ??
        po?.receipt_location_id ??
        po?.destination_location_id ??
        null;

  const stagingLocationId =
    shipment?.staging_location_id ?? po?.receipt_location_id ?? null;

  const requireBoe = resolveBoeRequirement(
    receiptStage,
    po?.tax_supply_nature,
    tenantSettings.require_boe_on_first_receipt,
    tenantSettings.allow_commercial_receipt_before_customs
  );

  const showGitLink =
    tenantSettings.imports_enabled &&
    tenantSettings.git_enabled &&
    tenantSettings.import_receipt_mode === "STAGING_THEN_GIT" &&
    (receiptStage === "GIT_CLEARANCE" || receiptStage === "FINAL");

  return {
    receiptStage,
    isPoFulfilling,
    allowedStages,
    showStageSelector: allowedStages.length > 1,
    requireBoe,
    boeEditable: receiptStage === "CUSTOMS" || (receiptStage !== "GIT_CLEARANCE" && !shipment?.bill_of_entry_number),
    defaultDestinationLocationId,
    stagingLocationId,
    showGitLink,
    useAtomicGitClearance: hasGitVoucher && receiptStage === "GIT_CLEARANCE",
  };
}

export function grnReceiptStageLabel(stage: GrnReceiptStage): string {
  switch (stage) {
    case "COMMERCIAL":
      return "Commercial / staging";
    case "CUSTOMS":
      return "Customs / BoE";
    case "FINAL":
      return "Final warehouse";
    case "GIT_CLEARANCE":
      return "GIT clearance";
    default:
      return stage;
  }
}
