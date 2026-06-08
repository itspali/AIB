import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EntityBankAccountRow,
  EntityContactRow,
  EntityDetailSnapshot,
  EntityOption,
  EntityOverviewStats,
  EntityRow,
} from "@/lib/entities/types";
import { getEntityLogoSignedUrl } from "@/lib/entities/logo";
import {
  isEntityCommercialType,
  isTaxTreatmentType,
} from "@/lib/entities/types";

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function mapEntityRow(row: Record<string, unknown>): EntityRow | null {
  const type = String(row.type ?? "");
  const taxTreatment = String(row.tax_treatment ?? "");
  if (!isEntityCommercialType(type) || !isTaxTreatmentType(taxTreatment)) {
    return null;
  }

  const customFields =
    row.custom_fields && typeof row.custom_fields === "object"
      ? (row.custom_fields as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    name: String(row.name),
    legal_name: (row.legal_name as string | null) ?? null,
    code: (row.code as string | null) ?? null,
    type,
    tax_registration_number: (row.tax_registration_number as string | null) ?? null,
    tax_treatment: taxTreatment,
    base_currency_override: (row.base_currency_override as string | null) ?? null,
    credit_limit: formatDecimal(row.credit_limit as number | string | null),
    current_balance: formatDecimal(row.current_balance as number | string | null),
    payment_terms_days: Number(row.payment_terms_days) || 0,
    billing_address_line1: (row.billing_address_line1 as string | null) ?? null,
    billing_address_line2: (row.billing_address_line2 as string | null) ?? null,
    billing_city: (row.billing_city as string | null) ?? null,
    billing_state: (row.billing_state as string | null) ?? null,
    billing_zip_postal: (row.billing_zip_postal as string | null) ?? null,
    billing_country_code: (row.billing_country_code as string | null) ?? null,
    shipping_address_line1: (row.shipping_address_line1 as string | null) ?? null,
    shipping_address_line2: (row.shipping_address_line2 as string | null) ?? null,
    shipping_city: (row.shipping_city as string | null) ?? null,
    shipping_state: (row.shipping_state as string | null) ?? null,
    shipping_zip_postal: (row.shipping_zip_postal as string | null) ?? null,
    shipping_country_code: (row.shipping_country_code as string | null) ?? null,
    incoterms_code: (row.incoterms_code as string | null) ?? null,
    default_shipping_method: (row.default_shipping_method as string | null) ?? null,
    company_email: (row.company_email as string | null) ?? null,
    company_phone: (row.company_phone as string | null) ?? null,
    website_url: (row.website_url as string | null) ?? null,
    internal_notes: (row.internal_notes as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    custom_fields: customFields,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapEntityContactRow(row: Record<string, unknown>): EntityContactRow {
  return {
    id: String(row.id),
    entity_id: String(row.entity_id),
    first_name: String(row.first_name),
    last_name: (row.last_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    mobile: (row.mobile as string | null) ?? null,
    whatsapp_number: (row.whatsapp_number as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    job_title: (row.job_title as string | null) ?? null,
    is_primary: Boolean(row.is_primary),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapEntityBankAccountRow(row: Record<string, unknown>): EntityBankAccountRow {
  return {
    id: String(row.id),
    entity_id: String(row.entity_id),
    account_holder_name: String(row.account_holder_name),
    account_number: String(row.account_number),
    ifsc_code: (row.ifsc_code as string | null) ?? null,
    bank_code: (row.bank_code as string | null) ?? null,
    bank_name: (row.bank_name as string | null) ?? null,
    branch_name: (row.branch_name as string | null) ?? null,
    upi_id: (row.upi_id as string | null) ?? null,
    is_primary: Boolean(row.is_primary),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order) || 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const ENTITY_SELECT =
  "id, name, legal_name, code, type, tax_registration_number, tax_treatment, base_currency_override, credit_limit, current_balance, payment_terms_days, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip_postal, billing_country_code, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_zip_postal, shipping_country_code, incoterms_code, default_shipping_method, company_email, company_phone, website_url, internal_notes, logo_url, custom_fields, is_active, created_at, updated_at";

const CONTACT_SELECT =
  "id, entity_id, first_name, last_name, email, phone, mobile, whatsapp_number, department, job_title, is_primary, is_active, created_at, updated_at";

const BANK_ACCOUNT_SELECT =
  "id, entity_id, account_holder_name, account_number, ifsc_code, bank_code, bank_name, branch_name, upi_id, is_primary, is_active, sort_order, created_at, updated_at";

export async function fetchEntityDetailById(
  supabase: SupabaseClient,
  tenantId: string,
  entityId: string
): Promise<EntityDetailSnapshot | null> {
  const [
    { data: entityData, error: entityError },
    { data: contactData, error: contactError },
    { data: bankData, error: bankError },
  ] = await Promise.all([
    supabase
      .from("entities")
      .select(ENTITY_SELECT)
      .eq("tenant_id", tenantId)
      .eq("id", entityId)
      .maybeSingle(),
    supabase
      .from("entity_contacts")
      .select(CONTACT_SELECT)
      .eq("tenant_id", tenantId)
      .eq("entity_id", entityId)
      .order("is_primary", { ascending: false })
      .order("first_name"),
    supabase
      .from("entity_bank_accounts")
      .select(BANK_ACCOUNT_SELECT)
      .eq("tenant_id", tenantId)
      .eq("entity_id", entityId)
      .order("sort_order")
      .order("is_primary", { ascending: false }),
  ]);

  if (entityError || contactError || bankError || !entityData) return null;

  const entity = mapEntityRow(entityData as Record<string, unknown>);
  if (!entity) return null;

  const contacts = (contactData ?? []).map((row) =>
    mapEntityContactRow(row as Record<string, unknown>)
  );
  const primaryContact = contacts.find((contact) => contact.is_primary) ?? null;
  const bankAccounts = (bankData ?? []).map((row) =>
    mapEntityBankAccountRow(row as Record<string, unknown>)
  );
  const logoPreviewUrl = await getEntityLogoSignedUrl(supabase, entity.logo_url);

  return {
    ...entity,
    contacts,
    primary_contact: primaryContact,
    bank_accounts: bankAccounts,
    logo_preview_url: logoPreviewUrl,
  };
}

export async function fetchEntityOverviewStats(
  supabase: SupabaseClient
): Promise<EntityOverviewStats> {
  const empty: EntityOverviewStats = {
    customer_count: 0,
    supplier_count: 0,
    active_customer_count: 0,
    active_supplier_count: 0,
    total_credit_limit: "0",
    total_current_balance: "0",
  };

  const { data, error } = await supabase.rpc("fetch_entity_overview_stats");

  if (error || !data?.length) return empty;

  const row = data[0] as Record<string, unknown>;
  return {
    customer_count: Number(row.customer_count) || 0,
    supplier_count: Number(row.supplier_count) || 0,
    active_customer_count: Number(row.active_customer_count) || 0,
    active_supplier_count: Number(row.active_supplier_count) || 0,
    total_credit_limit: formatDecimal(row.total_credit_limit as number | string | null),
    total_current_balance: formatDecimal(row.total_current_balance as number | string | null),
  };
}

async function fetchActiveEntityOptions(
  supabase: SupabaseClient,
  tenantId: string,
  types: readonly ("CUSTOMER" | "SUPPLIER" | "MUTUAL_PARTNER")[]
): Promise<EntityOption[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("id, name, code")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("type", [...types])
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string | null) ?? null,
  }));
}

export async function fetchActiveSupplierOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<EntityOption[]> {
  return fetchActiveEntityOptions(supabase, tenantId, ["SUPPLIER", "MUTUAL_PARTNER"]);
}

export async function fetchActiveCustomerOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<EntityOption[]> {
  return fetchActiveEntityOptions(supabase, tenantId, ["CUSTOMER", "MUTUAL_PARTNER"]);
}
