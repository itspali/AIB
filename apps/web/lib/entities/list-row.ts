import type { EntityDetailSnapshot, EntityListRow } from "@/lib/entities/types";

export function listRowFromDetail(detail: EntityDetailSnapshot): EntityListRow {
  const primary = detail.primary_contact;
  const primaryName = primary
    ? [primary.first_name, primary.last_name].filter(Boolean).join(" ").trim()
    : null;

  return {
    id: detail.id,
    name: detail.name,
    legal_name: detail.legal_name,
    code: detail.code,
    type: detail.type,
    party_nature: detail.party_nature,
    tax_treatment: detail.tax_treatment,
    tax_registration_number: detail.tax_registration_number,
    customer_category_id: detail.customer_category_id,
    customer_category_name: detail.customer_category_name,
    supplier_category_id: detail.supplier_category_id,
    supplier_category_name: detail.supplier_category_name,
    credit_limit: detail.credit_limit,
    current_balance: detail.current_balance,
    payment_terms_days: detail.payment_terms_days,
    company_email: detail.company_email,
    company_phone: detail.company_phone,
    is_active: detail.is_active,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    primary_contact_name: primaryName || null,
    primary_contact_email: primary?.email ?? null,
    logo_url: detail.logo_url,
  };
}
