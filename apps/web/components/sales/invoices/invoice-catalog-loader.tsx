import { InvoiceManagementTerminal } from "@/components/sales/invoices/invoice-management-terminal";
import { resolveSalesOrderEditAccess } from "@/lib/sales/access";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { fetchSalesInvoices } from "@/lib/sales/invoices/queries";
import { fetchSalesCustomers, fetchSalesLocations } from "@/lib/sales/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function InvoiceCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, customers, editAccess] = await Promise.all([
    fetchSalesLocations(supabase, tenantId),
    fetchSalesCustomers(supabase, tenantId),
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
  ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  preferredPurchaseOrderDestinationId(scopedLocations, editAccess.locationScope);
  const invoices = await fetchSalesInvoices(supabase, tenantId);

  return (
    <InvoiceManagementTerminal
      initialInvoices={invoices}
      customers={customers}
      locations={scopedLocations}
      editAccessGranted={editAccess.granted}
    />
  );
}
