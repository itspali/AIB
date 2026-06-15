import { SoManagementTerminal } from "@/components/sales/orders/so-management-terminal";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
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

import { fetchActivePoLineTaxCodeOptions } from "@/lib/tax/queries";

export async function SoCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, customers, editAccess, salesSettings, approvalSettings, tenantRow, documentLayout, taxCodeOptions] =
    await Promise.all([
      fetchSalesLocations(supabase, tenantId),
      fetchSalesCustomers(supabase, tenantId),
      resolveSalesOrderEditAccess(supabase, userId, tenantId),
      fetchSalesSettings(supabase, tenantId),
      fetchSalesApprovalSettings(supabase, tenantId),
      supabase
        .from("tenants")
        .select("base_currency, billing_country_code")
        .eq("id", tenantId)
        .maybeSingle(),
      resolveEffectiveDocumentLayout({
        supabase,
        tenantId,
        moduleKey: "SALES_ORDER",
        viewContext: "SCREEN_GRID",
      }),
      fetchActivePoLineTaxCodeOptions(supabase, tenantId),
    ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  const salesOrders = await fetchSalesOrders(
    supabase,
    tenantId,
    salesOrderFetchOptionsForScope(editAccess.locationScope)
  );

  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";
  const tenantCountry = (tenantRow.data?.billing_country_code as string | undefined) ?? null;
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
      allowTransactionDiscounts={salesSettings.allow_transaction_discounts}
      defaultCurrency={defaultCurrency}
      documentLayout={documentLayout}
      taxCodeOptions={taxCodeOptions}
      tenantCountry={tenantCountry}
      preferredShippingLocationId={preferredShippingLocationId ?? null}
      approvalSettings={approvalSettings}
      currentUserId={userId}
      isOwner={editAccess.isOwner}
      documentConversionMode={salesSettings.document_conversion_mode}
    />
  );
}
