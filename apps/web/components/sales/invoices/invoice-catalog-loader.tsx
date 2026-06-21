import dynamic from "next/dynamic";
import { InvoiceCatalogPageSkeleton } from "@/components/sales/invoices/invoice-catalog-page-skeleton";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import { resolveSalesOrderEditAccess } from "@/lib/sales/access";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { fetchSalesInvoicesPage } from "@/lib/sales/invoices/queries";
import { fetchSalesSettings } from "@/lib/sales/settings";
import { fetchSalesCustomers, fetchSalesLocations } from "@/lib/sales/shared/queries";
import { fetchActivePoLineTaxCodeOptions } from "@/lib/tax/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";

const InvoiceManagementTerminal = dynamic(
  () =>
    import("@/components/sales/invoices/invoice-management-terminal").then(
      (module) => module.InvoiceManagementTerminal
    ),
  { loading: () => <InvoiceCatalogPageSkeleton /> }
);

export async function InvoiceCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, customers, editAccess, salesSettings, approvalSettings, tenantRow, documentLayout, taxCodeOptions, gstRegistered, invoicesPage] =
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
        moduleKey: "SALES_INVOICE",
        viewContext: "SCREEN_GRID",
      }),
      fetchActivePoLineTaxCodeOptions(supabase, tenantId),
      fetchOrganizationGstRegistered(supabase, tenantId),
      fetchSalesInvoicesPage(supabase, tenantId),
    ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  preferredPurchaseOrderDestinationId(scopedLocations, editAccess.locationScope);

  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";
  const tenantCountry = (tenantRow.data?.billing_country_code as string | undefined) ?? null;

  return (
    <InvoiceManagementTerminal
      initialInvoices={invoicesPage.rows}
      listTotalCount={invoicesPage.totalCount}
      listHasMore={invoicesPage.hasMore}
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
      approvalSettings={approvalSettings}
      currentUserId={userId}
      isOwner={editAccess.isOwner}
    />
  );
}
