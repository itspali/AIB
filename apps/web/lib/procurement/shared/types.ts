export type ProcurementLocationOption = {
  id: string;
  name: string;
  code: string;
  state?: string | null;
};

import type { TaxTreatmentType } from "@/lib/entities/types";

export type ProcurementSupplierOption = {
  id: string;
  name: string;
  payment_terms_days: number;
  base_currency_override: string | null;
  billing_state?: string | null;
  billing_country_code?: string | null;
  tax_treatment?: TaxTreatmentType;
  incoterms_code?: string | null;
};
