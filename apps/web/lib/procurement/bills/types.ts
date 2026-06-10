import type { TaxTreatmentType } from "@/lib/entities/types";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";

export type PurchaseBillLineRow = {
  id: string;
  item_id: string;
  variant_id: string | null;
  quantity_billed: string;
  unit_price_billed: string;
  line_tax_computed: string;
  reverse_charge: boolean;
};

export type PurchaseBillRow = {
  id: string;
  invoice_number_vendor: string;
  system_voucher_number: string;
  supplier_id: string;
  supplier_name: string;
  purchase_order_id: string | null;
  tax_treatment: TaxTreatmentType;
  tax_supply_nature: PoTaxSupplyNature | null;
  tax_mechanism: GstTaxMechanism;
  rcm_applicable: boolean;
  total_gross_amount: string;
  total_tax_amount: string;
  total_liability_amount: string;
  is_paid: boolean;
  created_at: string;
  lines?: PurchaseBillLineRow[];
};
