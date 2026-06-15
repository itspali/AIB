import type { SalesOrderPartyAddress } from "@/lib/sales/orders/types";
import {
  toSalesAddressBlock,
  type SalesAddressBlock,
} from "@/lib/sales/shared/sales-party-address";

export type { SalesAddressBlock as SalesOrderAddressBlock };

export function resolveSoAddressBlocks(order: {
  customer_address: SalesOrderPartyAddress | null;
  shipping_address: SalesOrderPartyAddress | null;
  billing_state: string;
  shipping_state: string;
}): SalesAddressBlock[] {
  const blocks: SalesAddressBlock[] = [];

  const billTo = toSalesAddressBlock(
    "bill_to",
    "Bill to",
    order.customer_address,
    order.billing_state
  );
  const shipTo = toSalesAddressBlock(
    "ship_to",
    "Ship to",
    order.shipping_address,
    order.shipping_state
  );

  if (billTo) blocks.push(billTo);
  if (shipTo) blocks.push(shipTo);
  return blocks;
}
