import { BillManagementTerminal } from "@/components/procurement/bills/bill-management-terminal";
import { fetchPurchaseBills } from "@/lib/procurement/bills/queries";
import { fetchBillablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import {
  fetchProcurementLocations,
  fetchProcurementSuppliers,
} from "@/lib/procurement/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function BillCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [bills, suppliers, locations, billableOrders, procurementSettings] = await Promise.all([
    fetchPurchaseBills(supabase, tenantId),
    fetchProcurementSuppliers(supabase, tenantId),
    fetchProcurementLocations(supabase, tenantId),
    fetchBillablePurchaseOrders(supabase, tenantId),
    fetchProcurementSettings(supabase, tenantId),
  ]);

  const matchingTolerancePct = Number(procurementSettings.matching_tolerance_percentage);
  const tolerance = Number.isFinite(matchingTolerancePct) ? matchingTolerancePct : 2;

  return (
    <BillManagementTerminal
      initialBills={bills}
      suppliers={suppliers}
      locations={locations}
      billableOrders={billableOrders}
      matchingTolerancePct={tolerance}
    />
  );
}
