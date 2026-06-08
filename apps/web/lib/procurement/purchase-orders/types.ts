export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "ISSUED_ACTIVE"
  | "QC_HOLD"
  | "PARTIALLY_FULFILLED"
  | "FULLY_COMPLETED"
  | "CANCELLED";

export type PurchaseOrderLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_ordered: string;
  quantity_received: string;
  unit_price_contractual: string;
  line_total_gross: string;
  open_quantity: string;
};

export type PurchaseOrderRow = {
  id: string;
  voucher_number: string;
  destination_location_id: string;
  destination_location_name: string;
  destination_location_code: string;
  supplier_id: string;
  supplier_name: string;
  document_status: PurchaseOrderStatus;
  payment_terms_days: number;
  total_gross_amount: string;
  line_count: number;
  total_net_amount: string;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  lines?: PurchaseOrderLineRow[];
};

export type ReceivablePurchaseOrderOption = {
  id: string;
  voucher_number: string;
  destination_location_id: string;
  destination_location_name: string;
  destination_location_code: string;
  supplier_name: string;
  lines: PurchaseOrderLineRow[];
};
