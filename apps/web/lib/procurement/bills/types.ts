import type { PostingStepResult } from "@/lib/documents/posting-types";
import type { TaxTreatmentType } from "@/lib/entities/types";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";

export type { BillablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";

export type PurchaseBillLineRow = {
  id: string;
  item_id: string;
  variant_id: string | null;
  purchase_order_item_id?: string | null;
  item_name?: string;
  variant_sku?: string;
  quantity_billed: string;
  unit_price_billed: string;
  po_unit_price?: string | null;
  grn_landed_unit_cost?: string | null;
  line_tax_computed: string;
  reverse_charge: boolean;
};

export type LinkedGoodsReceiptSummary = {
  id: string;
  voucher_number: string;
};

export type PurchaseBillRow = {
  id: string;
  invoice_number_vendor: string;
  system_voucher_number: string;
  supplier_id: string;
  supplier_name: string;
  billing_location_id?: string | null;
  purchase_order_id: string | null;
  purchase_order_number?: string | null;
  tax_treatment: TaxTreatmentType;
  tax_supply_nature: PoTaxSupplyNature | null;
  tax_mechanism: GstTaxMechanism;
  rcm_applicable: boolean;
  total_gross_amount: string;
  total_tax_amount: string;
  total_liability_amount: string;
  match_status?: string;
  is_paid: boolean;
  created_at: string;
  lines?: PurchaseBillLineRow[];
  linked_goods_receipts?: LinkedGoodsReceiptSummary[];
  posting_steps?: PostingStepResult[];
  posting_at?: string | null;
};
