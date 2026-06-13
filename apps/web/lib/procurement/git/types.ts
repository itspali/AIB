export type GoodsInTransitStatus = "DRAFT" | "POSTED" | "CLEARED" | "CANCELLED";

export type GoodsInTransitLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  po_item_id: string | null;
  quantity: string;
  unit_cost: string;
};

export type GoodsInTransitRow = {
  id: string;
  voucher_number: string;
  status: GoodsInTransitStatus;
  source_location_id: string;
  source_location_name: string;
  git_holding_location_id: string;
  git_holding_location_name: string;
  destination_location_id: string | null;
  destination_location_name: string | null;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  line_count: number;
  posted_at: string | null;
  cleared_at: string | null;
  created_at: string;
  notes: string | null;
  lines?: GoodsInTransitLineRow[];
};

export function gitVoucherStatusLabel(status: GoodsInTransitStatus): string {
  switch (status) {
    case "POSTED":
      return "In transit";
    case "CLEARED":
      return "Cleared";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Draft";
  }
}
