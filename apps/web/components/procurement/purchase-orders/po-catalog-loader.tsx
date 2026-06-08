import { PoManagementTerminal } from "@/components/procurement/purchase-orders/po-management-terminal";
import { fetchPurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import {
  fetchProcurementLocations,
  fetchProcurementSuppliers,
} from "@/lib/procurement/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function PoCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, suppliers, purchaseOrders] = await Promise.all([
    fetchProcurementLocations(supabase, tenantId),
    fetchProcurementSuppliers(supabase, tenantId),
    fetchPurchaseOrders(supabase, tenantId),
  ]);

  return (
    <PoManagementTerminal
      initialPurchaseOrders={purchaseOrders}
      locations={locations}
      suppliers={suppliers}
    />
  );
}
