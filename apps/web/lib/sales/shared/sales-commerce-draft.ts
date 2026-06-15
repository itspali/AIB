import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import type { OrganizationCurrency } from "@/lib/organization/currency-options";
import { emptySalesHeaderCharges, type SalesHeaderChargesFields } from "@/lib/sales/shared/sales-header-charges";

export type SalesCommerceSupplyStatesInput = {
  customers: CustomerOption[];
  locations?: SalesLocationOption[];
  customerId: string;
  originLocationId?: string | null;
  billingState?: string | null;
  shippingState?: string | null;
};

export function resolveSalesCommerceSupplyStates(
  input: SalesCommerceSupplyStatesInput
): { billing_state: string; shipping_state: string } {
  const customer = input.customers.find((row) => row.id === input.customerId);
  const location = input.originLocationId
    ? input.locations?.find((row) => row.id === input.originLocationId)
    : undefined;
  const locationState = location?.state?.trim() ?? "";

  const billing_state =
    input.billingState?.trim() ||
    customer?.billing_state?.trim() ||
    customer?.shipping_state?.trim() ||
    locationState ||
    "";

  const shipping_state =
    input.shippingState?.trim() ||
    customer?.shipping_state?.trim() ||
    customer?.billing_state?.trim() ||
    locationState ||
    billing_state;

  return { billing_state, shipping_state };
}

export const SALES_SUPPLY_STATE_RESOLUTION_ERROR =
  "Supply state could not be determined. Add billing or shipping state on the customer record, or set state on the ship-from location.";

export function customerDefaultStates(
  customers: CustomerOption[],
  customerId: string,
  locations?: SalesLocationOption[],
  originLocationId?: string | null
): { billing_state: string; shipping_state: string } {
  return resolveSalesCommerceSupplyStates({
    customers,
    locations,
    customerId,
    originLocationId,
  });
}

export function customerDefaultCurrency(
  customers: CustomerOption[],
  customerId: string,
  defaultCurrency: string
): OrganizationCurrency {
  const customer = customers.find((row) => row.id === customerId);
  const override = customer?.base_currency_override?.trim();
  return (override || defaultCurrency) as OrganizationCurrency;
}

export function customerPaymentTerms(customers: CustomerOption[], customerId: string): string {
  const customer = customers.find((row) => row.id === customerId);
  return String(customer?.payment_terms_days ?? 0);
}

export type SalesCommerceDraftBase = {
  customer_id: string;
  currency_code: OrganizationCurrency;
  payment_terms_days: string;
  prices_tax_inclusive: boolean;
  header_charges: SalesHeaderChargesFields;
  billing_state: string;
  shipping_state: string;
};

export function emptySalesCommerceDraftBase(
  customers: CustomerOption[],
  defaultCurrency: string
): Pick<
  SalesCommerceDraftBase,
  "currency_code" | "payment_terms_days" | "prices_tax_inclusive" | "header_charges"
> {
  const customer = customers[0];
  return {
    currency_code: customer
      ? customerDefaultCurrency(customers, customer.id, defaultCurrency)
      : (defaultCurrency as OrganizationCurrency),
    payment_terms_days: customer ? customerPaymentTerms(customers, customer.id) : "0",
    prices_tax_inclusive: false,
    header_charges: emptySalesHeaderCharges(),
  };
}
