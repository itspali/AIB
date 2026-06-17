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
  quantity_reserved: string;
  quantity_available: string;
  current_average_cost: string;
  reorder_point: string | null;
  below_reorder: boolean;
  /** Promotional / sample sub-pool quantity at this location (display-only). */
  promo_quantity_on_hand?: string | null;
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

export const STOCK_LIST_VIEW_MODES = [
  "balances",
  "adjustments",
  "inventory_pools",
  "promo_reclassification",
] as const;

export type StockListViewMode = (typeof STOCK_LIST_VIEW_MODES)[number];

export function isStockListTableView(viewMode: StockListViewMode): boolean {
  return viewMode === "balances" || viewMode === "adjustments";
}

export type StockVariantOption = {
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  standard_cost: string | null;
  /** Item master default purchase rate (`_default_purchase_price`). */
  purchase_price: string | null;
  /** Item master default selling rate (`_default_selling_price` / price book). */
  selling_price?: string | null;
  adjustable: boolean;
  blocked_reason: string | null;
  image_url: string | null;
  base_unit_of_measure: string | null;
  /** PO line layout fields — available from variant search/browse without extra fetch. */
  description?: string | null;
  hsn_sac_code?: string | null;
  mrp?: string | null;
  variant_attributes?: Record<string, string>;
  custom_fields?: Record<string, string>;
  /** Item tax code from variant search — hydrates sales/PO tax column before full catalog fetch. */
  tax_code_id?: string | null;
  tax_rate?: number;
  tax_is_variable?: boolean;
  /** Alternate UOM rows from item master — hydrates line UOM before full catalog fetch. */
  alternate_uoms?: Array<{ uom_code: string; conversion_factor: number }>;
};
