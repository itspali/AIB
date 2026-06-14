import type { TaxTreatmentType } from "@/lib/entities/types";

export type SalesLocationOption = {
  id: string;
  name: string;
  code: string;
  state?: string | null;
};

export type CustomerOption = {
  id: string;
  name: string;
  payment_terms_days: number;
  base_currency_override: string | null;
  billing_state?: string | null;
  billing_country_code?: string | null;
  shipping_state?: string | null;
  shipping_country_code?: string | null;
  tax_treatment?: TaxTreatmentType;
};
