import type { CustomerOption } from "@/lib/sales/shared/types";
import {
  toSalesAddressBlock,
  type SalesAddressBlock,
  type SalesPartyAddress,
} from "@/lib/sales/shared/sales-party-address";

export function customerBillToAddress(
  customer: CustomerOption | undefined,
  fallbackName = ""
): SalesPartyAddress | null {
  if (!customer) return null;
  const name = customer.legal_name?.trim() || customer.name?.trim() || fallbackName;
  return {
    name,
    address_line1: customer.billing_address_line1?.trim() || null,
    address_line2: customer.billing_address_line2?.trim() || null,
    city: customer.billing_city?.trim() || null,
    state: customer.billing_state?.trim() || null,
    zip_postal: customer.billing_zip_postal?.trim() || null,
    country_code: customer.billing_country_code?.trim() || null,
    tax_identifier: customer.tax_registration_number?.trim() || null,
  };
}

export function customerShipToAddress(
  customer: CustomerOption | undefined,
  fallbackName = ""
): SalesPartyAddress | null {
  if (!customer) return null;
  const name = customer.name?.trim() || fallbackName;
  const hasShipping =
    customer.shipping_address_line1?.trim() ||
    customer.shipping_address_line2?.trim() ||
    customer.shipping_city?.trim() ||
    customer.shipping_state?.trim() ||
    customer.shipping_zip_postal?.trim() ||
    customer.shipping_country_code?.trim();

  if (!hasShipping) {
    return customerBillToAddress(customer, fallbackName);
  }

  return {
    name,
    address_line1: customer.shipping_address_line1?.trim() || null,
    address_line2: customer.shipping_address_line2?.trim() || null,
    city: customer.shipping_city?.trim() || null,
    state: customer.shipping_state?.trim() || null,
    zip_postal: customer.shipping_zip_postal?.trim() || null,
    country_code: customer.shipping_country_code?.trim() || null,
    tax_identifier: customer.tax_registration_number?.trim() || null,
  };
}

export function resolveSalesCommerceAddressBlocks(input: {
  customer?: CustomerOption;
  billing_state?: string | null;
  shipping_state?: string | null;
}): SalesAddressBlock[] {
  const blocks: SalesAddressBlock[] = [];
  const billTo = toSalesAddressBlock(
    "bill_to",
    "Bill to",
    customerBillToAddress(input.customer, input.customer?.name ?? ""),
    input.billing_state
  );
  const shipTo = toSalesAddressBlock(
    "ship_to",
    "Ship to",
    customerShipToAddress(input.customer, input.customer?.name ?? ""),
    input.shipping_state
  );

  if (billTo) blocks.push(billTo);
  if (shipTo) blocks.push(shipTo);
  return blocks;
}
