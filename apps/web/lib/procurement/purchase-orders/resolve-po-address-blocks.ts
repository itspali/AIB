import { resolvePurchaseOrderAddressBlocks } from "@/lib/procurement/purchase-orders/address-blocks";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";

export function resolvePoAddressBlocksForOrder(
  order: PurchaseOrderRow,
  organizationBillTo: OrganizationBillToSnapshot
) {
  return resolvePurchaseOrderAddressBlocks({
    supplier_name: order.supplier_name,
    supplier_address: order.supplier_address,
    destination_location_name: order.destination_location_name,
    destination_address: order.destination_address,
    organization_bill_to: organizationBillTo,
  });
}

export const PREVIEW_PO_ADDRESS_BLOCKS = resolvePurchaseOrderAddressBlocks({
  supplier_name: "Acme Supplies",
  supplier_address: {
    name: "Acme Supplies Pvt Ltd",
    address_line1: "12 Industrial Estate",
    address_line2: "Phase II",
    city: "Pune",
    state: "MH",
    zip_postal: "411045",
    country_code: "IN",
    tax_identifier: "27AABCA1234A1Z5",
  },
  destination_location_name: "Main warehouse",
  destination_address: {
    name: "Main warehouse",
    address_line1: "Plot 8, Logistics Park",
    address_line2: null,
    city: "Mumbai",
    state: "MH",
    zip_postal: "400001",
    country_code: "IN",
    tax_identifier: "27AABCO5678B1Z2",
  },
  organization_bill_to: {
    name: "Demo Organization",
    address_line1: "100 Corporate Tower",
    address_line2: "Bandra Kurla Complex",
    city: "Mumbai",
    state: "MH",
    zip_postal: "400051",
    country_code: "IN",
    tax_identifier: "27AABCD9999C1Z8",
  },
});
