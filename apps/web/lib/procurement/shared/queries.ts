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
    .select("id, name, code")
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
    .select("id, name, payment_terms_days")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("type", ["SUPPLIER", "MUTUAL_PARTNER"])
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    payment_terms_days: Number(row.payment_terms_days) || 0,
  }));
}
