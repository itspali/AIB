import type { SupabaseClient } from "@supabase/supabase-js";

export type SupplierPortalContext = {
  supplierEntityId: string;
  supplierName: string;
};

export type SupplierPortalPurchaseOrderRow = {
  id: string;
  voucher_number: string;
  document_status: string;
  destination_location_name: string;
  total_net_amount: string;
  currency_code: string;
  created_at: string;
  supplier_acknowledged_at: string | null;
};

export async function fetchSupplierPortalContext(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string
): Promise<SupplierPortalContext | null> {
  const { data, error } = await supabase
    .from("supplier_portal_users")
    .select("supplier_entity_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.supplier_entity_id) return null;

  const { data: entity } = await supabase
    .from("entities")
    .select("name")
    .eq("tenant_id", tenantId)
    .eq("id", data.supplier_entity_id)
    .maybeSingle();

  return {
    supplierEntityId: data.supplier_entity_id,
    supplierName: entity?.name ?? "Supplier",
  };
}

export async function fetchSupplierPortalPurchaseOrders(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SupplierPortalPurchaseOrderRow[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `
        id,
        voucher_number,
        document_status,
        total_net_amount,
        currency_code,
        created_at,
        supplier_acknowledged_at,
        destination_location:tenant_locations!purchase_orders_location_tenant_fk(name)
      `
    )
    .eq("tenant_id", tenantId)
    .in("document_status", ["ISSUED_ACTIVE", "PARTIALLY_FULFILLED", "FULLY_COMPLETED"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const destination = row.destination_location as { name?: string } | null;
    return {
      id: row.id as string,
      voucher_number: row.voucher_number as string,
      document_status: row.document_status as string,
      destination_location_name: destination?.name ?? "—",
      total_net_amount: String(row.total_net_amount ?? "0"),
      currency_code: (row.currency_code as string) ?? "USD",
      created_at: row.created_at as string,
      supplier_acknowledged_at: (row.supplier_acknowledged_at as string | null) ?? null,
    };
  });
}
