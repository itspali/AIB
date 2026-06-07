import { TransferManagementTerminal } from "@/components/inventory/transfers/transfer-management-terminal";
import {
  fetchStockTransfers,
  fetchTransferLocations,
} from "@/lib/inventory/transfers/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function TransferCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, transfers] = await Promise.all([
    fetchTransferLocations(supabase, tenantId),
    fetchStockTransfers(supabase, tenantId),
  ]);

  return (
    <TransferManagementTerminal initialTransfers={transfers} locations={locations} />
  );
}
