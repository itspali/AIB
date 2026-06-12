import { BillManagementTerminal } from "@/components/procurement/bills/bill-management-terminal";
import { fetchGoodsReceipts } from "@/lib/procurement/goods-receipts/queries";
import { fetchPurchaseBills } from "@/lib/procurement/bills/queries";
import { fetchReceivablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import {
  fetchProcurementLocations,
  fetchProcurementSuppliers,
} from "@/lib/procurement/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function BillCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [bills, suppliers, locations, receivableOrders, goodsReceipts] = await Promise.all([
    fetchPurchaseBills(supabase, tenantId),
    fetchProcurementSuppliers(supabase, tenantId),
    fetchProcurementLocations(supabase, tenantId),
    fetchReceivablePurchaseOrders(supabase, tenantId),
    fetchGoodsReceipts(supabase, tenantId),
  ]);

  return (
    <BillManagementTerminal
      initialBills={bills}
      suppliers={suppliers}
      locations={locations}
      receivableOrders={receivableOrders}
      initialGoodsReceipts={goodsReceipts}
    />
  );
}
