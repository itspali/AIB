import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import { PoManagementTerminal } from "@/components/procurement/purchase-orders/po-management-terminal";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { resolvePurchaseOrderEditAccess } from "@/lib/procurement/access";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { fetchProcurementApprovalSettings } from "@/lib/procurement/approval-settings-server";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import { fetchImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import { resolvePoAutoRoundOffPolicy } from "@/lib/procurement/purchase-orders/po-auto-round-off";
import { purchaseOrderFetchOptionsForScope } from "@/lib/procurement/purchase-orders/fetch-scope";
import { fetchPurchaseOrdersPage } from "@/lib/procurement/purchase-orders/queries";
import { mapOrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import {
  fetchProcurementLocations,
  fetchProcurementSuppliers,
} from "@/lib/procurement/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { getAppShellBootstrap } from "@/lib/layout/app-shell-bootstrap";
import { fetchActivePoLineTaxCodeOptions } from "@/lib/tax/queries";

export async function PoCatalogLoader() {
  const [{ supabase, tenantId, userId }, bootstrap] = await Promise.all([
    getModulePageContext(),
    getAppShellBootstrap(),
  ]);

  const [locations, suppliers, editAccess, procurementSettings, approvalSettings, tenantRow, documentLayout, taxCodeOptions, importLogisticsSettings] =
    await Promise.all([
      fetchProcurementLocations(supabase, tenantId),
      fetchProcurementSuppliers(supabase, tenantId),
      resolvePurchaseOrderEditAccess(supabase, userId, tenantId),
      fetchProcurementSettings(supabase, tenantId),
      fetchProcurementApprovalSettings(supabase, tenantId),
      supabase
        .from("tenants")
        .select(
          "base_currency, name, legal_name, trade_name, tax_identifier, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip_postal, billing_country_code"
        )
        .eq("id", tenantId)
        .maybeSingle(),
      resolveEffectiveDocumentLayout({
        supabase,
        tenantId,
        moduleKey: "PURCHASE_ORDER",
        viewContext: "SCREEN_GRID",
      }),
      fetchActivePoLineTaxCodeOptions(supabase, tenantId),
      fetchImportLogisticsSettings(supabase, tenantId),
    ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  const purchaseOrdersPage = await fetchPurchaseOrdersPage(
    supabase,
    tenantId,
    purchaseOrderFetchOptionsForScope(editAccess.locationScope)
  );

  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";
  const organizationBillTo = mapOrganizationBillToSnapshot(tenantRow.data ?? {});
  const preferredDestinationLocationId = preferredPurchaseOrderDestinationId(
    scopedLocations,
    editAccess.locationScope
  );

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="procurement-purchase-orders">
    <PoManagementTerminal
      initialPurchaseOrders={purchaseOrdersPage.rows}
      listTotalCount={purchaseOrdersPage.totalCount}
      listHasMore={purchaseOrdersPage.hasMore}
      locations={scopedLocations}
      suppliers={suppliers}
      editAccessGranted={editAccess.granted}
      allowEditIssuedPurchaseOrders={
        procurementSettings.allow_edit_issued_purchase_orders
      }
      allowLineItemDiscounts={procurementSettings.allow_line_item_discounts}
      allowTransactionDiscounts={procurementSettings.allow_transaction_discounts}
      enableMrpTradeTerms={procurementSettings.po_mrp_trade_terms_enabled}
      promoDefaultCategory={procurementSettings.promo_default_category}
      autoRoundOffPolicy={resolvePoAutoRoundOffPolicy(procurementSettings)}
      defaultPricesTaxInclusive={procurementSettings.purchase_prices_tax_inclusive}
      defaultCurrency={defaultCurrency}
      documentLayout={documentLayout}
      preferredDestinationLocationId={preferredDestinationLocationId ?? null}
      organizationBillTo={organizationBillTo}
      taxCodeOptions={taxCodeOptions}
      approvalSettings={approvalSettings}
      currentUserId={userId}
      isOwner={editAccess.isOwner}
      financeSetupComplete={bootstrap.financeSetupComplete}
      tenantDefaultFulfillmentStage={importLogisticsSettings.po_fulfillment_stage}
    />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
