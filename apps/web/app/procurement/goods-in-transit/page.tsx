import { GitManagementTerminal } from "@/components/procurement/goods-in-transit/git-management-terminal";
import { loadGitCatalogContext } from "@/app/procurement/goods-in-transit/actions";

export default async function GoodsInTransitPage() {
  const { vouchers, sourceLocations, gitLocations, receivableOrders } =
    await loadGitCatalogContext();

  return (
    <GitManagementTerminal
      initialVouchers={vouchers}
      sourceLocations={sourceLocations}
      gitLocations={gitLocations}
      receivableOrders={receivableOrders}
    />
  );
}
