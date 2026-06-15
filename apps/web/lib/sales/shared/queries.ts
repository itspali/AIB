import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

export async function fetchSalesLocations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SalesLocationOption[]> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select(
      "id, name, code, state, address_line1, address_line2, city, zip_postal, country_code, location_tax_identifier, tax_registered_name"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_stock_holding", true)
    .neq("presence_type", "VIRTUAL")
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string) ?? "",
    state: (row.state as string | null) ?? null,
    address_line1: (row.address_line1 as string | null) ?? null,
    address_line2: (row.address_line2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    zip_postal: (row.zip_postal as string | null) ?? null,
    country_code: (row.country_code as string | null) ?? null,
    location_tax_identifier: (row.location_tax_identifier as string | null) ?? null,
    tax_registered_name: (row.tax_registered_name as string | null) ?? null,
  }));
}

export async function fetchSalesLocationLabel(
  supabase: SupabaseClient,
  tenantId: string,
  locationId: string
): Promise<{ locationId: string; locationName: string; locationCode: string } | null> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("id, name, code")
    .eq("tenant_id", tenantId)
    .eq("id", locationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    locationId: data.id as string,
    locationName: data.name as string,
    locationCode: (data.code as string) ?? "",
  };
}

export async function fetchSalesCustomers(
  supabase: SupabaseClient,
  tenantId: string
): Promise<CustomerOption[]> {
  const { data, error } = await supabase
    .from("entities")
    .select(
      "id, name, legal_name, payment_terms_days, base_currency_override, credit_limit, current_balance, tax_registration_number, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip_postal, billing_country_code, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_zip_postal, shipping_country_code, tax_treatment"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("type", ["CUSTOMER", "MUTUAL_PARTNER"])
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    legal_name: (row.legal_name as string | null) ?? null,
    payment_terms_days: Number(row.payment_terms_days) || 0,
    base_currency_override: (row.base_currency_override as string | null) ?? null,
    credit_limit: formatDecimal(row.credit_limit as number | string | null),
    current_balance: formatDecimal(row.current_balance as number | string | null),
    tax_registration_number: (row.tax_registration_number as string | null) ?? null,
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
    tax_treatment: (row.tax_treatment as CustomerOption["tax_treatment"]) ?? "REGULAR_B2B",
  }));
}
