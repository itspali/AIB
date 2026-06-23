import type { TaxTreatmentType } from "@/lib/entities/types";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";

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
  quantity_invoiced?: string;
  unit_price_contractual: string;
  discount_percentage: string;
  discount_amount: string;
  line_total_gross: string;
  line_tax_amount: string;
  tax_rate_percentage: string;
  tax_components: Array<{ name: string; rate: number; amount: number }>;
  open_quantity: string;
  /** Order UOM persisted on the line (may differ from item base). */
  uom_code: string;
  uom_conversion_factor: string;
  /** Item base UOM — fallback when line uom is unset. */
  base_unit_of_measure?: string | null;
  /** Maximum retail price from item master at read time. */
  mrp?: string | null;
  is_promotional?: boolean;
  linked_parent_line_id?: string | null;
  promo_group_id?: string | null;
  promotional_category?: string | null;
  catalog_context?: PoLineCatalogContext | null;
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
  shipping_amount: string;
  shipping_tax_rate_pct: string;
  shipping_tax_amount: string;
  shipping_tax_type: "percent" | "amount";
  round_off_amount: string;
  additional_charges_amount: string;
  transaction_discount_percentage: string;
  transaction_discount_amount: string;
  transaction_discount_type: "percent" | "amount";
  prices_tax_inclusive: boolean;
  tax_supply_nature: PoTaxSupplyNature;
  tax_mechanism: GstTaxMechanism;
  supplier_tax_treatment: TaxTreatmentType | null;
  supplier_country_code: string | null;
  incoterms_code: string | null;
  rcm_applicable: boolean;
  custom_fields: Record<string, unknown>;
  created_by: string;
  created_by_name: string;
  /** Pending approval request submitter, when status is PENDING_APPROVAL. */
  approval_submitted_by?: string | null;
  approval_request_status?: string | null;
  approval_run_status?: string | null;
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
  tax_supply_nature: PoTaxSupplyNature;
  lines: PurchaseOrderLineRow[];
};

export type BillablePurchaseOrderOption = {
  id: string;
  voucher_number: string;
  supplier_id: string;
  destination_location_id: string;
  destination_location_name: string;
  destination_location_code: string;
  supplier_name: string;
  tax_supply_nature: PoTaxSupplyNature;
  currency_code: string;
  lines: PurchaseOrderLineRow[];
};
