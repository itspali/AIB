import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type FulfillmentOverviewStats = {
  shipment_count: number;
  in_transit_count: number;
  ready_to_ship_count: number;
};

async function countForTenant(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  filters?: Record<string, string | null>
): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null);
      } else {
        query = query.eq(key, value);
      }
    }
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function fetchFulfillmentOverviewStats(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FulfillmentOverviewStats> {
  const [shipmentCount, inTransitCount, readyToShipCount] = await Promise.all([
    countForTenant(supabase, "sales_shipments", tenantId),
    countForTenant(supabase, "sales_shipments", tenantId, { delivered_at: null }),
    supabase
      .from("sales_orders")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("commercial_status", ["APPROVED_ACTIVE", "PARTIALLY_SHIPPED"])
      .in("fulfillment_status", ["NOT_FULFILLED", "PICKING_PACKING"])
      .then(({ count, error }) => (error ? 0 : count ?? 0)),
  ]);

  return {
    shipment_count: shipmentCount,
    in_transit_count: inTransitCount,
    ready_to_ship_count: readyToShipCount,
  };
}
