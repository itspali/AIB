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
  discount_percentage: string;
  discount_amount: string;
  line_total_gross: string;
  line_tax_amount: string;
  tax_rate_percentage: string;
  open_quantity: string;
  /** Order UOM persisted on the line (may differ from item base). */
  uom_code: string;
  uom_conversion_factor: string;
  /** Item base UOM — fallback when line uom is unset. */
  base_unit_of_measure?: string | null;
};

export type PurchaseOrderPartyAddress = {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_postal: string | null;
  country_code: string | null;
  tax_identifier: string | null;
};

export type PurchaseOrderRow = {
  id: string;
  voucher_number: string;
  destination_location_id: string;
  destination_location_name: string;
  destination_location_code: string;
  supplier_id: string;
  supplier_name: string;
  supplier_address: PurchaseOrderPartyAddress | null;
  destination_address: PurchaseOrderPartyAddress | null;
  document_status: PurchaseOrderStatus;
  currency_code: string;
  payment_terms_days: number;
  total_gross_amount: string;
  total_tax_amount: string;
  line_count: number;
  total_net_amount: string;
  custom_fields: Record<string, unknown>;
  created_by: string;
  created_by_name: string;
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
