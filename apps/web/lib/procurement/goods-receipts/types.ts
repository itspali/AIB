import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";

export type GoodsReceiptLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  po_item_id: string | null;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
  raw_unit_cost: string;
  total_final_landed_cost: string;
};

export type GoodsReceiptRow = {
  id: string;
  voucher_number: string;
  destination_location_id: string;
  destination_location_name: string;
  destination_location_code: string;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  is_qc_pending: boolean;
  line_count: number;
  received_at: string;
  created_at: string;
  lines?: GoodsReceiptLineRow[];
};

export type GrnDrawerCreatePrefill = {
  purchase_order_id?: string;
  destination_location_id?: string;
};

export type { ProcurementLocationOption };
