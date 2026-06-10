import type { TaxTreatmentType } from "@/lib/entities/types";
import {
  gstResolveSupplyContext,
  gstSupplyNatureLabel,
  type GstSupplyNature,
  type GstTaxMechanism,
} from "@/lib/tax/gst-supply-context";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";

/** PO tax supply nature — includes import and export paths. */
export type PoTaxSupplyNature = GstSupplyNature;

export const PO_TAX_SUPPLY_NATURE_LABEL: Record<PoTaxSupplyNature, string> = {
  INTRASTATE: "Intrastate",
  INTERSTATE: "Interstate",
  IMPORT_GOODS: "Import (goods)",
  IMPORT_SERVICES: "Import (services)",
  EXPORT: "Export",
};

export function isPoTaxSupplyNature(value: string): value is PoTaxSupplyNature {
  return (
    value === "INTRASTATE" ||
    value === "INTERSTATE" ||
    value === "IMPORT_GOODS" ||
    value === "IMPORT_SERVICES" ||
    value === "EXPORT"
  );
}

/** Legacy state-only resolver — prefer `resolvePoGstContextFromForm`. */
export function resolvePoTaxSupplyNature(
  supplierState: string | null | undefined,
  destinationState: string | null | undefined
): PoTaxSupplyNature {
  const supplier = (supplierState ?? "").trim().toUpperCase();
  const destination = (destinationState ?? "").trim().toUpperCase();
  if (supplier.length > 0 && supplier === destination) {
    return "INTRASTATE";
  }
  return "INTERSTATE";
}

export function mapSalesTaxModeToPoSupplyNature(mode: string): PoTaxSupplyNature {
  return mode === "CGST_SGST" ? "INTRASTATE" : "INTERSTATE";
}

export type PoGstContext = {
  supplyNature: PoTaxSupplyNature;
  taxMechanism: GstTaxMechanism;
  taxTreatmentApplied: string;
};

export function resolvePoGstContext(input: {
  tenantCountry?: string | null;
  supplierTaxTreatment?: TaxTreatmentType | null;
  supplierCountry?: string | null;
  supplierState?: string | null;
  destinationState?: string | null;
}): PoGstContext {
  const ctx = gstResolveSupplyContext({
    tenantCountry: input.tenantCountry ?? "IN",
    partyTaxTreatment: input.supplierTaxTreatment ?? "REGULAR_B2B",
    partyCountry: input.supplierCountry,
    partyState: input.supplierState,
    destinationState: input.destinationState,
    documentSide: "PURCHASE",
    supplyKind: "GOODS",
  });
  return {
    supplyNature: ctx.supplyNature,
    taxMechanism: ctx.taxMechanism,
    taxTreatmentApplied: ctx.taxTreatmentApplied,
  };
}

export function resolvePoGstContextFromForm(
  suppliers: ProcurementSupplierOption[],
  supplierId: string,
  locations: ProcurementLocationOption[],
  destinationLocationId: string,
  tenantCountry?: string | null
): PoGstContext {
  const supplier = suppliers.find((row) => row.id === supplierId);
  const location = locations.find((row) => row.id === destinationLocationId);
  return resolvePoGstContext({
    tenantCountry,
    supplierTaxTreatment: supplier?.tax_treatment,
    supplierCountry: supplier?.billing_country_code,
    supplierState: supplier?.billing_state,
    destinationState: location?.state,
  });
}

/** @deprecated Use resolvePoGstContextFromForm */
export function resolvePoTaxSupplyNatureFromForm(
  suppliers: ProcurementSupplierOption[],
  supplierId: string,
  locations: ProcurementLocationOption[],
  destinationLocationId: string
): PoTaxSupplyNature {
  return resolvePoGstContextFromForm(suppliers, supplierId, locations, destinationLocationId)
    .supplyNature;
}

export function poTaxSupplyNatureLabel(nature: PoTaxSupplyNature): string {
  return gstSupplyNatureLabel(nature);
}
