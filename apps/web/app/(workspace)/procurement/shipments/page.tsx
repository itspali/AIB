import { ShipmentManagementTerminal } from "@/components/procurement/shipments/shipment-management-terminal";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { loadShipmentCatalogContext } from "@/app/(workspace)/procurement/shipments/actions";
import { getModulePageContext } from "@/lib/layout/module-page";
import { requireImportLogisticsEnabled } from "@/lib/procurement/require-import-logistics";

export default async function ProcurementShipmentsPage() {
  const { supabase, tenantId } = await getModulePageContext();
  await requireImportLogisticsEnabled(supabase, tenantId);

  const { shipments, suppliers, locations, allocatableOrders } = await loadShipmentCatalogContext();

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="procurement-shipments">
    <ShipmentManagementTerminal
      initialShipments={shipments}
      suppliers={suppliers}
      locations={locations}
      allocatableOrders={allocatableOrders}
    />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
