export type StockAdjustmentKind = "OPENING" | "CORRECTION" | "WRITE_OFF";

export type StockBalanceRow = {
  id: string;
  location_id: string;
  location_name: string;
  location_code: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  base_unit_of_measure: string;
  total_quantity_on_hand: string;
  current_average_cost: string;
  reorder_point: string | null;
  below_reorder: boolean;
};

export type StockAdjustmentLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_delta: string;
  unit_cost: string;
  line_notes: string | null;
};

export type StockAdjustmentRow = {
  id: string;
  location_id: string;
  location_name: string;
  location_code: string;
  adjustment_number: string;
  kind: StockAdjustmentKind;
  reason: string;
  notes: string | null;
  posted_at: string;
  line_count: number;
  lines?: StockAdjustmentLineRow[];
};

export type StockLocationOption = {
  id: string;
  name: string;
  code: string;
};

export type StockListViewMode = "balances" | "adjustments";

export type StockVariantOption = {
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  standard_cost: string | null;
  adjustable: boolean;
  blocked_reason: string | null;
};
