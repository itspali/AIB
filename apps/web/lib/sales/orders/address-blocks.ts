import type { SalesOrderPartyAddress } from "@/lib/sales/orders/types";

export type SalesOrderAddressBlock = {
  kind: "bill_to" | "ship_to" | "ship_from";
  title: string;
  name: string;
  lines: string[];
  tax_identifier: string | null;
};

function formatAddressLines(address: SalesOrderPartyAddress | null): string[] {
  if (!address) return [];
  const lines: string[] = [];
  if (address.address_line1) lines.push(address.address_line1);
  if (address.address_line2) lines.push(address.address_line2);
  const cityLine = [address.city, address.state, address.zip_postal]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  if (address.country_code) lines.push(address.country_code);
  return lines;
}

export function resolveSoAddressBlocks(order: {
  customer_name: string;
  customer_address: SalesOrderPartyAddress | null;
  shipping_address: SalesOrderPartyAddress | null;
  shipping_location_name: string;
}): SalesOrderAddressBlock[] {
  const blocks: SalesOrderAddressBlock[] = [];

  const billTo = order.customer_address ?? {
    name: order.customer_name,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    zip_postal: null,
    country_code: null,
    tax_identifier: null,
  };

  blocks.push({
    kind: "bill_to",
    title: "Bill to",
    name: billTo.name || order.customer_name,
    lines: formatAddressLines(billTo),
    tax_identifier: billTo.tax_identifier,
  });

  const shipTo = order.shipping_address;
  if (shipTo) {
    blocks.push({
      kind: "ship_to",
      title: "Ship to",
      name: shipTo.name || order.shipping_location_name,
      lines: formatAddressLines(shipTo),
      tax_identifier: shipTo.tax_identifier,
    });
  }

  return blocks;
}
