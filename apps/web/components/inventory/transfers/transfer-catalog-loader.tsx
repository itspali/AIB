import dynamic from "next/dynamic";
import { TransferCatalogPageSkeleton } from "@/components/inventory/transfers/transfer-catalog-page-skeleton";
import {
  fetchStockTransfersPage,
  fetchTransferLocations,
} from "@/lib/inventory/transfers/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

const TransferManagementTerminal = dynamic(
  () =>
    import("@/components/inventory/transfers/transfer-management-terminal").then(
      (module) => module.TransferManagementTerminal
    ),
  { loading: () => <TransferCatalogPageSkeleton /> }
);

export async function TransferCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, transfersPage] = await Promise.all([
    fetchTransferLocations(supabase, tenantId),
    fetchStockTransfersPage(supabase, tenantId),
  ]);

  return (
    <TransferManagementTerminal
      initialTransfers={transfersPage.rows}
      listTotalCount={transfersPage.totalCount}
      listHasMore={transfersPage.hasMore}
      locations={locations}
    />
  );
}
