import dynamic from "next/dynamic";
import { GrnCatalogPageSkeleton } from "@/components/procurement/goods-receipts/grn-catalog-page-skeleton";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { fetchGoodsReceiptsPage } from "@/lib/procurement/goods-receipts/queries";
import { fetchReceivablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import { fetchProcurementLocations } from "@/lib/procurement/shared/queries";
import { fetchImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import type { ImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import type { LandedCostAllocationMethod } from "@/lib/procurement/settings";
import { getModulePageContext } from "@/lib/layout/module-page";

const GrnManagementTerminal = dynamic(
  () =>
    import("@/components/procurement/goods-receipts/grn-management-terminal").then(
      (module) => module.GrnManagementTerminal
    ),
  { loading: () => <GrnCatalogPageSkeleton /> }
);

export async function GrnCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, goodsReceiptsPage, receivableOrders, procurementSettings, importLogisticsSettings] =
    await Promise.all([
    fetchProcurementLocations(supabase, tenantId),
    fetchGoodsReceiptsPage(supabase, tenantId),
    fetchReceivablePurchaseOrders(supabase, tenantId),
    fetchProcurementSettings(supabase, tenantId),
    fetchImportLogisticsSettings(supabase, tenantId),
  ]);

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="procurement-goods-receipts">
    <GrnManagementTerminal
      initialGoodsReceipts={goodsReceiptsPage.rows}
      listTotalCount={goodsReceiptsPage.totalCount}
      listHasMore={goodsReceiptsPage.hasMore}
      initialReceivableOrders={receivableOrders}
      locations={locations}
      procurementSettings={procurementSettings}
      importLogisticsSettings={importLogisticsSettings}
      defaultLandedCostAllocationMethod={
        procurementSettings.landed_cost_allocation_method as LandedCostAllocationMethod
      }
    />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
