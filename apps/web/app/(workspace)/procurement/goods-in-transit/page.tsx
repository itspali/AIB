import { GitManagementTerminal } from "@/components/procurement/goods-in-transit/git-management-terminal";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { loadGitCatalogContext } from "@/app/procurement/goods-in-transit/actions";
import { getModulePageContext } from "@/lib/layout/module-page";
import { requireImportLogisticsEnabled } from "@/lib/procurement/require-import-logistics";

export default async function GoodsInTransitPage() {
  const { supabase, tenantId } = await getModulePageContext();
  await requireImportLogisticsEnabled(supabase, tenantId);

  const { vouchers, sourceLocations, gitLocations, receivableOrders } =
    await loadGitCatalogContext();

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="procurement-goods-in-transit">
    <GitManagementTerminal
      initialVouchers={vouchers}
      sourceLocations={sourceLocations}
      gitLocations={gitLocations}
      receivableOrders={receivableOrders}
    />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
