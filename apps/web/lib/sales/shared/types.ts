import type { TaxTreatmentType } from "@/lib/entities/types";

export type SalesLocationOption = {
  id: string;
  name: string;
  code: string;
  state?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  zip_postal?: string | null;
  country_code?: string | null;
  location_tax_identifier?: string | null;
  tax_registered_name?: string | null;
};

export type CustomerOption = {
  id: string;
  name: string;
  legal_name?: string | null;
  payment_terms_days: number;
  base_currency_override: string | null;
  credit_limit?: string;
  current_balance?: string;
  tax_registration_number?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip_postal?: string | null;
  billing_country_code?: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_zip_postal?: string | null;
  shipping_country_code?: string | null;
  tax_treatment?: TaxTreatmentType;
};
