export const FULFILLMENT_SHIPPING_HREF = "/fulfillment/shipping";

export const SHIPMENT_DRAWER_SO_PARAM = "so";

export function fulfillmentShippingHrefWithSalesOrder(salesOrderId: string): string {
  return `${FULFILLMENT_SHIPPING_HREF}?action=new&${SHIPMENT_DRAWER_SO_PARAM}=${encodeURIComponent(salesOrderId)}`;
}
