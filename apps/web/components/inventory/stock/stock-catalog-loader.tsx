import dynamic from "next/dynamic";
import { StockCatalogPageSkeleton } from "@/components/inventory/stock/stock-catalog-page-skeleton";
import {
  fetchStockAdjustmentsPage,
  fetchStockBalancesPage,
  fetchStockLocations,
} from "@/lib/inventory/stock/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

const StockManagementTerminal = dynamic(
  () =>
    import("@/components/inventory/stock/stock-management-terminal").then(
      (module) => module.StockManagementTerminal
    ),
  { loading: () => <StockCatalogPageSkeleton /> }
);

export async function StockCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, balancesPage, adjustmentsPage] = await Promise.all([
    fetchStockLocations(supabase, tenantId),
    fetchStockBalancesPage(supabase, tenantId),
    fetchStockAdjustmentsPage(supabase, tenantId),
  ]);

  return (
    <StockManagementTerminal
      initialBalances={balancesPage.rows}
      listTotalCount={balancesPage.totalCount}
      listHasMore={balancesPage.hasMore}
      initialAdjustments={adjustmentsPage.rows}
      adjustmentsTotalCount={adjustmentsPage.totalCount}
      adjustmentsHasMore={adjustmentsPage.hasMore}
      locations={locations}
    />
  );
}
