import { PaymentManagementTerminal } from "@/components/sales/payments/payment-management-terminal";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { resolveSalesOrderEditAccess } from "@/lib/sales/access";
import { fetchCustomerPayments } from "@/lib/sales/payments/queries";
import { fetchSalesCustomers } from "@/lib/sales/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function PaymentCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [customers, editAccess] = await Promise.all([
    fetchSalesCustomers(supabase, tenantId),
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
  ]);

  const payments = await fetchCustomerPayments(supabase, tenantId);

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId="sales-payments">
    <PaymentManagementTerminal
      initialPayments={payments}
      customers={customers}
      editAccessGranted={editAccess.granted}
    />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
