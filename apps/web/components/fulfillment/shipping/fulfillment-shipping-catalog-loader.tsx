import dynamic from "next/dynamic";
import { FulfillmentShippingCatalogPageSkeleton } from "@/components/fulfillment/shipping/fulfillment-shipping-catalog-page-skeleton";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { fetchSalesShipments } from "@/lib/fulfillment/shipping/queries";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const FulfillmentShippingManagementTerminal = dynamic(
  () =>
    import("@/components/fulfillment/shipping/fulfillment-shipping-management-terminal").then(
      (module) => module.FulfillmentShippingManagementTerminal
    ),
  { loading: () => <FulfillmentShippingCatalogPageSkeleton /> }
);

export async function FulfillmentShippingCatalogLoader() {
  const { supabase, tenantId } = await requireTenantId();
  const shipments = await fetchSalesShipments(supabase, tenantId);

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="fulfillment-shipping">
    <FulfillmentShippingManagementTerminal initialShipments={shipments} />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
