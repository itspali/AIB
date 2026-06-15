import type { TaxTreatmentType } from "@/lib/entities/types";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesPaymentStatus } from "@/lib/sales/orders/types";

export type SalesInvoiceLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_invoiced: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  line_total_net: string;
  line_tax_amount: string;
  source_order_line_id: string | null;
  base_unit_of_measure?: string | null;
  uom_code?: string | null;
  uom_conversion_factor?: string | null;
};

export type SalesInvoiceRow = {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  origin_location_id: string;
  origin_location_name: string;
  origin_location_code: string;
  source_order_id: string | null;
  source_order_number: string | null;
  source_quotation_id: string | null;
  commercial_status: SalesDocumentStatus;
  invoice_payment_status: SalesPaymentStatus;
  billing_state: string;
  shipping_state: string;
  payment_terms_days: number;
  total_gross_amount: string;
  total_tax_amount: string;
  total_net_amount: string;
  total_paid_amount: string;
  line_count: number;
  customer_tax_treatment: TaxTreatmentType | null;
  custom_fields: Record<string, unknown>;
  created_by: string;
  created_by_name: string;
  approval_submitted_by?: string | null;
  created_at: string;
  updated_at: string;
  lines?: SalesInvoiceLineRow[];
};

export type InvoicePaymentApplicationRow = {
  id: string;
  amount_applied: string;
  applied_at: string;
  payment_number: string;
  payment_method: string;
  reference_number: string | null;
};

export type OpenSalesInvoiceOption = {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  total_net_amount: string;
  total_paid_amount: string;
  outstanding_amount: string;
};
