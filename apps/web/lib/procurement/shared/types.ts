export type ProcurementLocationOption = {
  id: string;
  name: string;
  code: string;
  state?: string | null;
};

export type ProcurementSupplierOption = {
  id: string;
  name: string;
  payment_terms_days: number;
  base_currency_override: string | null;
  billing_state?: string | null;
};
