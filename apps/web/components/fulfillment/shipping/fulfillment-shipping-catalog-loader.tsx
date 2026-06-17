import { FulfillmentShippingManagementTerminal } from "@/components/fulfillment/shipping/fulfillment-shipping-management-terminal";
import { fetchSalesShipments } from "@/lib/fulfillment/shipping/queries";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export async function FulfillmentShippingCatalogLoader() {
  const { supabase, tenantId } = await requireTenantId();
  const shipments = await fetchSalesShipments(supabase, tenantId);

  return <FulfillmentShippingManagementTerminal initialShipments={shipments} />;
}
