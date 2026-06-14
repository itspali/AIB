import type { PostingStepResult } from "@/lib/documents/posting-types";
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
  /** Remaining units in the QC hold pool (when receipt is QC pending). */
  quantity_on_qc_hold?: string;
  route_to_qc?: boolean;
  raw_unit_cost: string;
  total_final_landed_cost: string;
  import_igst_amount: string;
  customs_duty_amount: string;
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
  bill_of_entry_number: string | null;
  bill_of_entry_date: string | null;
  port_code: string | null;
  exchange_rate: string | null;
  assessable_value: string | null;
  customs_duty_amount: string | null;
  import_igst_amount: string | null;
  lines?: GoodsReceiptLineRow[];
  posting_steps?: PostingStepResult[];
  posting_at?: string | null;
};

export type GrnDrawerCreatePrefill = {
  purchase_order_id?: string;
  destination_location_id?: string;
};

export type { ProcurementLocationOption };
