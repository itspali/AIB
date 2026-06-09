export const ENTITY_COMMERCIAL_TYPES = [
  "CUSTOMER",
  "SUPPLIER",
  "MUTUAL_PARTNER",
] as const;

export type EntityCommercialType = (typeof ENTITY_COMMERCIAL_TYPES)[number];

export const TAX_TREATMENT_TYPES = [
  "REGULAR_B2B",
  "COMPOSITION",
  "UNREGISTERED_B2C",
  "SEZ_DEVELOPER",
  "OVERSEAS_EXPORT",
  "DEEMED_EXPORT",
] as const;

export type TaxTreatmentType = (typeof TAX_TREATMENT_TYPES)[number];

export const PARTY_NATURE_TYPES = ["INDIVIDUAL", "ORGANIZATION"] as const;

export type PartyNatureType = (typeof PARTY_NATURE_TYPES)[number];

export type EntityWorkspace = "customer" | "supplier";

export type EntityRow = {
  id: string;
  name: string;
  legal_name: string | null;
  code: string | null;
  type: EntityCommercialType;
  party_nature: PartyNatureType;
  tax_registration_number: string | null;
  tax_treatment: TaxTreatmentType;
  customer_category_id: string | null;
  customer_category_name: string | null;
  supplier_category_id: string | null;
  supplier_category_name: string | null;
  base_currency_override: string | null;
  credit_limit: string;
  current_balance: string;
  payment_terms_days: number;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip_postal: string | null;
  billing_country_code: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip_postal: string | null;
  shipping_country_code: string | null;
  incoterms_code: string | null;
  default_shipping_method: string | null;
  company_email: string | null;
  company_phone: string | null;
  website_url: string | null;
  internal_notes: string | null;
  logo_url: string | null;
  custom_fields: Record<string, unknown>;
  customer_custom_fields: Record<string, unknown>;
  supplier_custom_fields: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EntityContactRow = {
  id: string;
  entity_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  whatsapp_number: string | null;
  department: string | null;
  job_title: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EntityBankAccountRow = {
  id: string;
  entity_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string | null;
  bank_code: string | null;
  bank_name: string | null;
  branch_name: string | null;
  upi_id: string | null;
  is_primary: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EntityListRow = {
  id: string;
  name: string;
  legal_name: string | null;
  code: string | null;
  type: EntityCommercialType;
  party_nature: PartyNatureType;
  tax_treatment: TaxTreatmentType;
  tax_registration_number: string | null;
  customer_category_id: string | null;
  customer_category_name: string | null;
  supplier_category_id: string | null;
  supplier_category_name: string | null;
  credit_limit: string;
  current_balance: string;
  payment_terms_days: number;
  company_email: string | null;
  company_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  logo_url?: string | null;
};

export type EntityDetailSnapshot = EntityRow & {
  contacts: EntityContactRow[];
  primary_contact: EntityContactRow | null;
  bank_accounts: EntityBankAccountRow[];
  logo_preview_url?: string | null;
};

export type EntityFormContactValues = {
  contact_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile: string;
  whatsapp_number: string;
  department: string;
  job_title: string;
  use_mobile_for_whatsapp: boolean;
  is_primary: boolean;
  is_active: boolean;
};

export type EntityFormBankAccountValues = {
  account_id: string | null;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_code: string;
  bank_name: string;
  branch_name: string;
  upi_id: string;
  is_primary: boolean;
  is_active: boolean;
};

export type EntityFormValues = {
  entity_id: string | null;
  logo_url: string;
  draft_storage_key: string;
  name: string;
  type: EntityCommercialType;
  party_nature: PartyNatureType;
  tax_treatment: TaxTreatmentType;
  customer_category_id: string;
  supplier_category_id: string;
  tax_registration_number: string;
  legal_name: string;
  code: string;
  credit_limit: string;
  payment_terms_days: string;
  base_currency_override: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_state: string;
  billing_zip_postal: string;
  billing_country_code: string;
  shipping_address_line1: string;
  shipping_address_line2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip_postal: string;
  shipping_country_code: string;
  same_as_billing: boolean;
  incoterms_code: string;
  default_shipping_method: string;
  company_email: string;
  company_phone: string;
  website_url: string;
  internal_notes: string;
  custom_fields: Record<string, string>;
  customer_custom_fields: Record<string, string>;
  supplier_custom_fields: Record<string, string>;
  is_active: boolean;
  primary_contact: EntityFormContactValues;
  extended_contacts: EntityFormContactValues[];
  bank_accounts: EntityFormBankAccountValues[];
};

export type EntityOverviewStats = {
  customer_count: number;
  supplier_count: number;
  active_customer_count: number;
  active_supplier_count: number;
  total_credit_limit: string;
  total_current_balance: string;
};

export type EntityWorkspaceConfig = {
  workspace: EntityWorkspace;
  title: string;
  description: string;
  listHref: string;
  defaultType: EntityCommercialType;
  typeFilter: readonly EntityCommercialType[];
  savedViewModuleKey: string;
  listColumnRegistryKey: "customer" | "supplier";
  createLabel: string;
  singularLabel: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
};

export type EntityOption = {
  id: string;
  name: string;
  code: string | null;
};

export function isEntityCommercialType(value: string): value is EntityCommercialType {
  return (ENTITY_COMMERCIAL_TYPES as readonly string[]).includes(value);
}

export function isTaxTreatmentType(value: string): value is TaxTreatmentType {
  return (TAX_TREATMENT_TYPES as readonly string[]).includes(value);
}

export function isPartyNatureType(value: string): value is PartyNatureType {
  return (PARTY_NATURE_TYPES as readonly string[]).includes(value);
}

export function isEntityWorkspace(value: string): value is EntityWorkspace {
  return value === "customer" || value === "supplier";
}

export function taxRegistrationRequired(taxTreatment: TaxTreatmentType): boolean {
  return taxTreatment !== "UNREGISTERED_B2C" && taxTreatment !== "OVERSEAS_EXPORT";
}
