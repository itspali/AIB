import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";

export async function fetchProcurementLocations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProcurementLocationOption[]> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("id, name, code, state")
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
  }));
}

export async function fetchProcurementLocationLabel(
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

export async function fetchProcurementSuppliers(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProcurementSupplierOption[]> {
  const { data, error } = await supabase
    .from("entities")
    .select(
      "id, name, payment_terms_days, base_currency_override, billing_state, billing_country_code, tax_treatment, incoterms_code"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("type", ["SUPPLIER", "MUTUAL_PARTNER"])
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    payment_terms_days: Number(row.payment_terms_days) || 0,
    base_currency_override: (row.base_currency_override as string | null) ?? null,
    billing_state: (row.billing_state as string | null) ?? null,
    billing_country_code: (row.billing_country_code as string | null) ?? null,
    tax_treatment: (row.tax_treatment as ProcurementSupplierOption["tax_treatment"]) ?? "REGULAR_B2B",
    incoterms_code: (row.incoterms_code as string | null) ?? null,
  }));
}
