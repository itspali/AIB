import { SoManagementTerminal } from "@/components/sales/orders/so-management-terminal";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";
import { salesOrderFetchOptionsForScope } from "@/lib/sales/orders/fetch-scope";
import { fetchSalesOrders } from "@/lib/sales/orders/queries";
import { fetchSalesSettings } from "@/lib/sales/settings";
import { resolveSalesOrderEditAccess } from "@/lib/sales/access";
import {
  fetchSalesCustomers,
  fetchSalesLocations,
} from "@/lib/sales/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function SoCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, customers, editAccess, salesSettings, approvalSettings, tenantRow] =
    await Promise.all([
      fetchSalesLocations(supabase, tenantId),
      fetchSalesCustomers(supabase, tenantId),
      resolveSalesOrderEditAccess(supabase, userId, tenantId),
      fetchSalesSettings(supabase, tenantId),
      fetchSalesApprovalSettings(supabase, tenantId),
      supabase.from("tenants").select("base_currency").eq("id", tenantId).maybeSingle(),
    ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  const salesOrders = await fetchSalesOrders(
    supabase,
    tenantId,
    salesOrderFetchOptionsForScope(editAccess.locationScope)
  );

  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";
  const preferredShippingLocationId = preferredPurchaseOrderDestinationId(
    scopedLocations,
    editAccess.locationScope
  );

  return (
    <SoManagementTerminal
      initialSalesOrders={salesOrders}
      locations={scopedLocations}
      customers={customers}
      editAccessGranted={editAccess.granted}
      allowLineItemDiscounts={salesSettings.allow_line_item_discounts}
      defaultCurrency={defaultCurrency}
      preferredShippingLocationId={preferredShippingLocationId ?? null}
      approvalSettings={approvalSettings}
      currentUserId={userId}
      isOwner={editAccess.isOwner}
    />
  );
}
