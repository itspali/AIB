/**
 * Placeholder for sales-side promo pool consumption (`PROMO_FULFILLMENT_SHIPMENT`).
 * Wire when outbound shipment posts against promo_inventory_balances.
 */
export type PromoFulfillmentShipmentStub = {
  goods_receipt_item_id?: string | null;
  entitlement_id?: string | null;
  quantity: number;
};

export function isPromoFulfillmentShipmentReady(): boolean {
  return false;
}

export function describePromoFulfillmentShipmentStatus(): string {
  if (isPromoFulfillmentShipmentReady()) {
    return "Sales shipments can consume promotional stock from the promo sub-pool.";
  }
  return "Promo fulfillment shipments are not wired yet — stock remains in the promotional sub-pool until sales outbound is connected.";
}
