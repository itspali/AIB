export type StockTransferStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "DISPATCHED_IN_TRANSIT"
  | "RECEIPT_DISCREPANCY"
  | "FULLY_COMPLETED"
  | "CANCELLED";

export type TransferLocationOption = {
  id: string;
  name: string;
  code: string;
};

export type TransferLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_dispatched: string;
  quantity_accepted: string;
  quantity_damaged: string;
  quantity_lost: string;
  source_unit_cost_at_dispatch: string;
};

export type StockTransferRow = {
  id: string;
  transfer_number: string;
  source_location_id: string;
  source_location_name: string;
  source_location_code: string;
  destination_location_id: string;
  destination_location_name: string;
  destination_location_code: string;
  current_status: StockTransferStatus;
  line_count: number;
  inter_company_freight_cost: string;
  loading_overhead_cost: string;
  unloading_overhead_cost: string;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
  lines?: TransferLineRow[];
};

export type TransferDrawerCreatePrefill = {
  source_location_id: string;
  destination_location_id: string;
  variant_id: string;
  variant_sku: string;
  item_name: string;
};
