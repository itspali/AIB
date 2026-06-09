import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import {
  formatPostalAddressLines,
  hasPostalAddress,
  type PostalAddressInput,
} from "@/lib/procurement/purchase-orders/postal-address";
import type { PurchaseOrderPartyAddress } from "@/lib/procurement/purchase-orders/types";

export type PurchaseOrderAddressBlockKind = "vendor" | "ship_to" | "bill_to";

export type PurchaseOrderAddressBlock = {
  kind: PurchaseOrderAddressBlockKind;
  title: string;
  name: string;
  lines: string[];
  tax_identifier: string | null;
};

export type ResolvePurchaseOrderAddressBlocksInput = {
  supplier_name: string;
  supplier_address: PurchaseOrderPartyAddress | null;
  destination_location_name: string;
  destination_address: PurchaseOrderPartyAddress | null;
  organization_bill_to: OrganizationBillToSnapshot;
};

function blockFromParty(
  kind: PurchaseOrderAddressBlockKind,
  title: string,
  name: string,
  address: PostalAddressInput,
  tax_identifier: string | null
): PurchaseOrderAddressBlock | null {
  const lines = formatPostalAddressLines(address);
  const displayName = name.trim();
  const taxId = tax_identifier?.trim() || null;
  if (!displayName && lines.length === 0 && !taxId) return null;

  return {
    kind,
    title,
    name: displayName || "—",
    lines,
    tax_identifier: taxId,
  };
}

export function resolvePurchaseOrderAddressBlocks(
  input: ResolvePurchaseOrderAddressBlocksInput
): PurchaseOrderAddressBlock[] {
  const supplier = input.supplier_address;
  const destination = input.destination_address;
  const billTo = input.organization_bill_to;

  const vendorName = supplier?.name?.trim() || input.supplier_name.trim();
  const vendor = blockFromParty(
    "vendor",
    "Vendor",
    vendorName,
    supplier ?? {},
    supplier?.tax_identifier ?? null
  );

  const shipName =
    destination?.name?.trim() ||
    input.destination_location_name.trim() ||
    "Destination";
  const shipTo = blockFromParty(
    "ship_to",
    "Ship to",
    shipName,
    destination ?? {},
    destination?.tax_identifier ?? null
  );

  const billToBlock = blockFromParty(
    "bill_to",
    "Bill to",
    billTo.name,
    billTo,
    billTo.tax_identifier
  );

  return [vendor, shipTo, billToBlock].filter(
    (block): block is PurchaseOrderAddressBlock => block !== null
  );
}

export function addressBlockHasContent(block: PurchaseOrderAddressBlock): boolean {
  return Boolean(block.name.trim() && block.name !== "—") || block.lines.length > 0 || Boolean(block.tax_identifier);
}

export function organizationBillToHasAddress(billTo: OrganizationBillToSnapshot): boolean {
  return hasPostalAddress(billTo) || Boolean(billTo.tax_identifier?.trim());
}
