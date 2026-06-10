import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";

export type PoTaxSupplyNature = "INTRASTATE" | "INTERSTATE";

export const PO_TAX_SUPPLY_NATURE_LABEL: Record<PoTaxSupplyNature, string> = {
  INTRASTATE: "Intrastate",
  INTERSTATE: "Interstate",
};

export function isPoTaxSupplyNature(value: string): value is PoTaxSupplyNature {
  return value === "INTRASTATE" || value === "INTERSTATE";
}

/** Client mirror of `private.resolve_sales_tax_mode` → PO supply nature labels. */
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

export function resolvePoTaxSupplyNatureFromForm(
  suppliers: ProcurementSupplierOption[],
  supplierId: string,
  locations: ProcurementLocationOption[],
  destinationLocationId: string
): PoTaxSupplyNature {
  const supplier = suppliers.find((row) => row.id === supplierId);
  const location = locations.find((row) => row.id === destinationLocationId);
  return resolvePoTaxSupplyNature(supplier?.billing_state, location?.state);
}

export function poTaxSupplyNatureLabel(nature: PoTaxSupplyNature): string {
  return PO_TAX_SUPPLY_NATURE_LABEL[nature];
}
