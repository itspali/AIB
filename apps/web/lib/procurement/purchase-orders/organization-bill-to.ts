export type OrganizationBillToSnapshot = {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_postal: string | null;
  country_code: string | null;
  tax_identifier: string | null;
};

type TenantBillToRow = {
  name?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  tax_identifier?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip_postal?: string | null;
  billing_country_code?: string | null;
};

export function mapOrganizationBillToSnapshot(row: TenantBillToRow): OrganizationBillToSnapshot {
  const name =
    row.trade_name?.trim() ||
    row.legal_name?.trim() ||
    row.name?.trim() ||
    "Organization";

  return {
    name,
    address_line1: row.billing_address_line1?.trim() || null,
    address_line2: row.billing_address_line2?.trim() || null,
    city: row.billing_city?.trim() || null,
    state: row.billing_state?.trim() || null,
    zip_postal: row.billing_zip_postal?.trim() || null,
    country_code: row.billing_country_code?.trim() || null,
    tax_identifier: row.tax_identifier?.trim() || null,
  };
}
