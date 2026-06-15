import type { TaxTreatmentType } from "@/lib/entities/types";
import {
  gstResolveSupplyContext,
  gstSupplyNatureLabel,
  type GstSupplyNature,
  type GstTaxMechanism,
} from "@/lib/tax/gst-supply-context";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";

export type SalesTaxSupplyNature = GstSupplyNature;

export function salesTaxSupplyNatureLabel(nature: SalesTaxSupplyNature): string {
  return gstSupplyNatureLabel(nature);
}

export type SalesGstContext = {
  supplyNature: SalesTaxSupplyNature;
  taxMechanism: GstTaxMechanism;
  taxTreatmentApplied: string;
};

export function resolveSalesGstContext(input: {
  tenantCountry?: string | null;
  customerTaxTreatment?: TaxTreatmentType | null;
  customerCountry?: string | null;
  customerState?: string | null;
  originState?: string | null;
}): SalesGstContext {
  const ctx = gstResolveSupplyContext({
    tenantCountry: input.tenantCountry ?? "IN",
    partyTaxTreatment: input.customerTaxTreatment ?? "REGULAR_B2B",
    partyCountry: input.customerCountry,
    partyState: input.customerState,
    destinationState: input.originState,
    documentSide: "SALE",
    supplyKind: "GOODS",
  });
  return {
    supplyNature: ctx.supplyNature,
    taxMechanism: ctx.taxMechanism,
    taxTreatmentApplied: ctx.taxTreatmentApplied,
  };
}

export function resolveSalesGstContextFromForm(
  customers: CustomerOption[],
  customerId: string,
  locations: SalesLocationOption[],
  originLocationId: string,
  tenantCountry?: string | null
): SalesGstContext {
  const customer = customers.find((row) => row.id === customerId);
  const location = locations.find((row) => row.id === originLocationId);
  return resolveSalesGstContext({
    tenantCountry,
    customerTaxTreatment: customer?.tax_treatment,
    customerCountry: customer?.billing_country_code,
    customerState: customer?.shipping_state ?? customer?.billing_state,
    originState: location?.state,
  });
}
