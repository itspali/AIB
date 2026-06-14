import { QuoteManagementTerminal } from "@/components/sales/quotes/quote-management-terminal";
import { resolveSalesOrderEditAccess } from "@/lib/sales/access";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { fetchSalesQuotations } from "@/lib/sales/quotes/queries";
import { fetchSalesCustomers, fetchSalesLocations } from "@/lib/sales/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function QuoteCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, customers, editAccess] = await Promise.all([
    fetchSalesLocations(supabase, tenantId),
    fetchSalesCustomers(supabase, tenantId),
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
  ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  const preferredOriginLocationId = preferredPurchaseOrderDestinationId(
    scopedLocations,
    editAccess.locationScope
  );
  const quotes = await fetchSalesQuotations(supabase, tenantId);

  return (
    <QuoteManagementTerminal
      initialQuotes={quotes}
      customers={customers}
      locations={scopedLocations}
      editAccessGranted={editAccess.granted}
    />
  );
}
