import { PoManagementTerminal } from "@/components/procurement/purchase-orders/po-management-terminal";
import { resolvePurchaseOrderEditAccess } from "@/lib/procurement/access";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import { fetchPurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import {
  fetchProcurementLocations,
  fetchProcurementSuppliers,
} from "@/lib/procurement/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function PoCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, suppliers, purchaseOrders, editAccess, procurementSettings, tenantRow] =
    await Promise.all([
      fetchProcurementLocations(supabase, tenantId),
      fetchProcurementSuppliers(supabase, tenantId),
      fetchPurchaseOrders(supabase, tenantId),
      resolvePurchaseOrderEditAccess(supabase, userId, tenantId),
      fetchProcurementSettings(supabase, tenantId),
      supabase.from("tenants").select("base_currency").eq("id", tenantId).maybeSingle(),
    ]);

  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";

  return (
    <PoManagementTerminal
      initialPurchaseOrders={purchaseOrders}
      locations={locations}
      suppliers={suppliers}
      editAccessGranted={editAccess.granted}
      allowEditIssuedPurchaseOrders={
        procurementSettings.allow_edit_issued_purchase_orders
      }
      defaultCurrency={defaultCurrency}
    />
  );
}
