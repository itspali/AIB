import type { TaxTreatmentType } from "@/lib/entities/types";

export type GstTaxMechanism =
  | "FORWARD"
  | "REVERSE_CHARGE"
  | "IMPORT_IGST"
  | "ZERO_RATED"
  | "EXEMPT"
  | "COMPOSITION";

export type GstSupplyNature =
  | "INTRASTATE"
  | "INTERSTATE"
  | "IMPORT_GOODS"
  | "IMPORT_SERVICES"
  | "EXPORT";

export type GstDocumentSide = "PURCHASE" | "SALE";

export type GstSupplyKind = "GOODS" | "SERVICES";

export type GstSupplyContext = {
  supplyNature: GstSupplyNature;
  taxMechanism: GstTaxMechanism;
  taxTreatmentApplied: string;
};

export const GST_TAX_MECHANISM_LABELS: Record<GstTaxMechanism, string> = {
  FORWARD: "Forward charge",
  REVERSE_CHARGE: "Reverse charge (RCM)",
  IMPORT_IGST: "Import IGST",
  ZERO_RATED: "Zero-rated",
  EXEMPT: "Exempt",
  COMPOSITION: "Composition scheme",
};

export const GST_SUPPLY_NATURE_LABELS: Record<GstSupplyNature, string> = {
  INTRASTATE: "Intrastate",
  INTERSTATE: "Interstate",
  IMPORT_GOODS: "Import (goods)",
  IMPORT_SERVICES: "Import (services)",
  EXPORT: "Export",
};

function normalizeCountry(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizeState(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function gstIsOverseasParty(
  taxTreatment: TaxTreatmentType,
  partyCountry: string | null | undefined
): boolean {
  const country = normalizeCountry(partyCountry);
  return taxTreatment === "OVERSEAS_EXPORT" || (country.length > 0 && country !== "IN");
}

function resolveSalesTaxMode(originState: string, destinationState: string): "CGST_SGST" | "IGST" {
  if (originState.length > 0 && originState === destinationState) {
    return "CGST_SGST";
  }
  return "IGST";
}

function mapSalesTaxModeToSupplyNature(mode: "CGST_SGST" | "IGST"): "INTRASTATE" | "INTERSTATE" {
  return mode === "CGST_SGST" ? "INTRASTATE" : "INTERSTATE";
}

/** Client mirror of `private.gst_resolve_supply_context`. */
export function gstResolveSupplyContext(input: {
  tenantCountry: string | null | undefined;
  partyTaxTreatment: TaxTreatmentType;
  partyCountry: string | null | undefined;
  partyState: string | null | undefined;
  destinationState: string | null | undefined;
  documentSide: GstDocumentSide;
  supplyKind?: GstSupplyKind;
}): GstSupplyContext {
  const tenantCountry = normalizeCountry(input.tenantCountry);
  const partyCountry = normalizeCountry(input.partyCountry);
  const partyState = normalizeState(input.partyState);
  const destinationState = normalizeState(input.destinationState);
  const supplyKind = input.supplyKind ?? "GOODS";
  const overseas = gstIsOverseasParty(input.partyTaxTreatment, partyCountry);

  if (tenantCountry !== "IN") {
    const mode = resolveSalesTaxMode(partyState, destinationState);
    return {
      supplyNature: mapSalesTaxModeToSupplyNature(mode),
      taxMechanism: "FORWARD",
      taxTreatmentApplied: mode,
    };
  }

  if (input.documentSide === "SALE") {
    if (
      input.partyTaxTreatment === "OVERSEAS_EXPORT" ||
      input.partyTaxTreatment === "SEZ_DEVELOPER" ||
      input.partyTaxTreatment === "DEEMED_EXPORT" ||
      overseas
    ) {
      return {
        supplyNature: "EXPORT",
        taxMechanism: "ZERO_RATED",
        taxTreatmentApplied: "ZERO_RATED",
      };
    }

    if (input.partyTaxTreatment === "COMPOSITION") {
      return {
        supplyNature: "INTRASTATE",
        taxMechanism: "COMPOSITION",
        taxTreatmentApplied: "COMPOSITION",
      };
    }

    const mode = resolveSalesTaxMode(partyState, destinationState);
    return {
      supplyNature: mapSalesTaxModeToSupplyNature(mode),
      taxMechanism: "FORWARD",
      taxTreatmentApplied: mode,
    };
  }

  if (overseas || input.partyTaxTreatment === "OVERSEAS_EXPORT") {
    if (supplyKind === "SERVICES") {
      return {
        supplyNature: "IMPORT_SERVICES",
        taxMechanism: "REVERSE_CHARGE",
        taxTreatmentApplied: "IGST",
      };
    }
    return {
      supplyNature: "IMPORT_GOODS",
      taxMechanism: "IMPORT_IGST",
      taxTreatmentApplied: "IGST",
    };
  }

  if (input.partyTaxTreatment === "COMPOSITION") {
    const mode = resolveSalesTaxMode(partyState, destinationState);
    return {
      supplyNature: mapSalesTaxModeToSupplyNature(mode),
      taxMechanism: "COMPOSITION",
      taxTreatmentApplied: mode,
    };
  }

  if (input.partyTaxTreatment === "SEZ_DEVELOPER") {
    return {
      supplyNature: "INTERSTATE",
      taxMechanism: "ZERO_RATED",
      taxTreatmentApplied: "IGST",
    };
  }

  const mode = resolveSalesTaxMode(partyState, destinationState);
  return {
    supplyNature: mapSalesTaxModeToSupplyNature(mode),
    taxMechanism: "FORWARD",
    taxTreatmentApplied: mode,
  };
}

export function isGstImportSupplyNature(supplyNature: GstSupplyNature): boolean {
  return supplyNature === "IMPORT_GOODS" || supplyNature === "IMPORT_SERVICES";
}

export function shouldZeroVendorGstOnPo(mechanism: GstTaxMechanism): boolean {
  return mechanism === "IMPORT_IGST" || mechanism === "REVERSE_CHARGE" || mechanism === "ZERO_RATED";
}

export function gstSupplyNatureLabel(nature: GstSupplyNature): string {
  return GST_SUPPLY_NATURE_LABELS[nature];
}

export function gstTaxMechanismLabel(mechanism: GstTaxMechanism): string {
  return GST_TAX_MECHANISM_LABELS[mechanism];
}
