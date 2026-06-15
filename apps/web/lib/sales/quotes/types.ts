import type { TaxTreatmentType } from "@/lib/entities/types";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";

export type SalesQuoteLineRow = {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_quoted: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  line_total_gross: string;
  line_tax_amount: string;
  base_unit_of_measure?: string | null;
  uom_code?: string | null;
  uom_conversion_factor?: string | null;
};

export type SalesQuoteRow = {
  id: string;
  quotation_number: string;
  customer_id: string;
  customer_name: string;
  origin_location_id: string | null;
  origin_location_name: string;
  origin_location_code: string;
  commercial_status: SalesDocumentStatus;
  valid_until: string;
  billing_state: string;
  shipping_state: string;
  payment_terms_days: number;
  total_gross_amount: string;
  total_tax_amount: string;
  line_count: number;
  total_net_amount: string;
  customer_tax_treatment: TaxTreatmentType | null;
  custom_fields: Record<string, unknown>;
  converted_to_order_id: string | null;
  converted_to_invoice_id: string | null;
  created_by: string;
  created_by_name: string;
  approval_submitted_by?: string | null;
  created_at: string;
  updated_at: string;
  lines?: SalesQuoteLineRow[];
};
