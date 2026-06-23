import type { GrnRejectDisposition } from "@/lib/procurement/goods-receipts/grn-reject-dispositions";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";

export type QcTestParameterType = "BOOLEAN" | "NUMERIC" | "TEXT" | "CHOICE";
export type QcParameterResult = "PASS" | "FAIL" | "NA";

export type QcTestParameterDef = {
  id: string;
  name: string;
  parameter_type: QcTestParameterType;
  min_value: string | null;
  max_value: string | null;
  expected_text: string | null;
  choice_options: string[];
  is_mandatory: boolean;
  sort_order: number;
};

export type QcTestTemplate = {
  id: string;
  name: string;
  description: string | null;
  scope_type: "ITEM" | "CATEGORY";
  scope_reference_id: string;
  parameters: QcTestParameterDef[];
};

export type QcInspectionQueueRow = {
  /** goods_receipt_item_id — drawer record id */
  id: string;
  qc_balance_id: string;
  goods_receipt_id: string;
  grn_number: string;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  destination_location_id: string;
  destination_location_name: string;
  destination_location_code: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_on_hold: string;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
  route_to_qc: boolean;
  is_promotional: boolean;
  received_at: string;
};

export type QcInspectionResultLineInput = {
  parameter_id?: string | null;
  parameter_name: string;
  parameter_type: QcTestParameterType;
  min_value?: string | null;
  max_value?: string | null;
  expected_text?: string | null;
  choice_options?: string[];
  measured_value: string;
  result: QcParameterResult;
  is_mandatory: boolean;
  sort_order: number;
};

export type CompleteQcLineInspectionInput = {
  goods_receipt_item_id: string;
  quantity_released: string;
  quantity_failed?: string;
  failed_disposition?: GrnRejectDisposition;
  notes?: string | null;
  result_lines?: QcInspectionResultLineInput[];
};

export type { ProcurementLocationOption };
