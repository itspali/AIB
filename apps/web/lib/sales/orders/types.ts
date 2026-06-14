import type { TaxTreatmentType } from "@/lib/entities/types";

export type SalesOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "CREDIT_HOLD"
  | "APPROVED_ACTIVE"
  | "PARTIALLY_SHIPPED"
  | "FULLY_COMPLETED"
  | "CANCELLED";

export type SalesFulfillmentStatus =
  | "NOT_FULFILLED"
  | "PICKING_PACKING"
  | "DISPATCHED_IN_TRANSIT"
  | "DELIVERED"
  | "RETURNED_PARTIAL"
  | "RETURNED_FULLY";

export type SalesPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "FULLY_PAID" | "REFUNDED";

export type SalesOrderLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_ordered: string;
  quantity_shipped: string;
  quantity_invoiced: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  line_total_gross: string;
  line_tax_amount: string;
  open_quantity: string;
  base_unit_of_measure?: string | null;
};

export type SalesOrderPartyAddress = {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_postal: string | null;
  country_code: string | null;
  tax_identifier: string | null;
};

export type SalesOrderRow = {
  id: string;
  voucher_number: string;
  customer_id: string;
  customer_name: string;
  customer_address: SalesOrderPartyAddress | null;
  shipping_location_id: string | null;
  shipping_location_name: string;
  shipping_location_code: string;
  shipping_address: SalesOrderPartyAddress | null;
  commercial_status: SalesOrderStatus;
  fulfillment_status: SalesFulfillmentStatus;
  payment_status: SalesPaymentStatus;
  billing_state: string;
  shipping_state: string;
  total_gross_amount: string;
  total_tax_amount: string;
  line_count: number;
  total_net_amount: string;
  customer_tax_treatment: TaxTreatmentType | null;
  custom_fields: Record<string, unknown>;
  source_quotation_id: string | null;
  created_by: string;
  created_by_name: string;
  /** Pending approval request submitter, when status is PENDING_APPROVAL. */
  approval_submitted_by?: string | null;
  created_at: string;
  updated_at: string;
  lines?: SalesOrderLineRow[];
};
