import { QuoteManagementTerminal } from "@/components/sales/quotes/quote-management-terminal";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import { resolveSalesOrderEditAccess } from "@/lib/sales/access";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { fetchSalesQuotationsPage } from "@/lib/sales/quotes/queries";
import { fetchSalesSettings } from "@/lib/sales/settings";
import { fetchSalesCustomers, fetchSalesLocations } from "@/lib/sales/shared/queries";
import { fetchActivePoLineTaxCodeOptions } from "@/lib/tax/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";

export async function QuoteCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, customers, editAccess, salesSettings, approvalSettings, tenantRow, documentLayout, taxCodeOptions, gstRegistered, quotesPage] =
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
        moduleKey: "SALES_QUOTATION",
        viewContext: "SCREEN_GRID",
      }),
      fetchActivePoLineTaxCodeOptions(supabase, tenantId),
      fetchOrganizationGstRegistered(supabase, tenantId),
      fetchSalesQuotationsPage(supabase, tenantId),
    ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  const preferredOriginLocationId = preferredPurchaseOrderDestinationId(
    scopedLocations,
    editAccess.locationScope
  );

  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";
  const tenantCountry = (tenantRow.data?.billing_country_code as string | undefined) ?? null;

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="sales-quotes">
    <QuoteManagementTerminal
      initialQuotes={quotesPage.rows}
      listTotalCount={quotesPage.totalCount}
      listHasMore={quotesPage.hasMore}
      customers={customers}
      locations={scopedLocations}
      editAccessGranted={editAccess.granted}
      allowLineItemDiscounts={salesSettings.allow_line_item_discounts}
      allowTransactionDiscounts={salesSettings.allow_transaction_discounts}
      defaultCurrency={defaultCurrency}
      documentLayout={documentLayout}
      taxCodeOptions={taxCodeOptions}
      tenantCountry={tenantCountry}
      gstRegistered={gstRegistered}
      preferredOriginLocationId={preferredOriginLocationId ?? null}
      documentConversionMode={salesSettings.document_conversion_mode}
      approvalSettings={approvalSettings}
      currentUserId={userId}
      isOwner={editAccess.isOwner}
    />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
