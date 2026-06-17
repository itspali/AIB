export type ShippingCarrierProvider =
  | "FEDEX"
  | "DHL"
  | "UPS"
  | "BLUE_DART"
  | "CUSTOM_FLEET";

export type SalesShipmentLineRow = {
  id: string;
  sales_order_item_id: string;
  item_name: string;
  variant_sku: string;
  quantity_shipped: string;
  quantity_ordered: string;
  quantity_open: string;
};

export type SalesShipmentRow = {
  id: string;
  sales_order_id: string;
  sales_order_voucher: string;
  customer_name: string;
  origin_location_id: string;
  origin_location_name: string;
  origin_location_code: string;
  carrier_provider: ShippingCarrierProvider;
  tracking_number: string;
  dispatched_at: string;
  delivered_at: string | null;
  line_count: number;
  lines?: SalesShipmentLineRow[];
};

export type ShippableSalesOrderLine = {
  id: string;
  item_name: string;
  variant_sku: string;
  quantity_ordered: string;
  quantity_allocated: string;
  quantity_shipped: string;
  open_quantity: string;
};

export type ShippableSalesOrder = {
  id: string;
  voucher_number: string;
  customer_name: string;
  shipping_location_id: string;
  shipping_location_name: string;
  commercial_status: string;
  lines: ShippableSalesOrderLine[];
};
