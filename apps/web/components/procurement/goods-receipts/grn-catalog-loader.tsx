import { GrnManagementTerminal } from "@/components/procurement/goods-receipts/grn-management-terminal";
import { fetchGoodsReceipts } from "@/lib/procurement/goods-receipts/queries";
import { fetchReceivablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import { fetchProcurementLocations } from "@/lib/procurement/shared/queries";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import type { LandedCostAllocationMethod } from "@/lib/procurement/settings";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function GrnCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, goodsReceipts, receivableOrders, procurementSettings] = await Promise.all([
    fetchProcurementLocations(supabase, tenantId),
    fetchGoodsReceipts(supabase, tenantId),
    fetchReceivablePurchaseOrders(supabase, tenantId),
    fetchProcurementSettings(supabase, tenantId),
  ]);

  return (
    <GrnManagementTerminal
      initialGoodsReceipts={goodsReceipts}
      initialReceivableOrders={receivableOrders}
      locations={locations}
      procurementSettings={procurementSettings}
      defaultLandedCostAllocationMethod={
        procurementSettings.landed_cost_allocation_method as LandedCostAllocationMethod
      }
    />
  );
}
