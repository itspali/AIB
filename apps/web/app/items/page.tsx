import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import { fetchProductListRows } from "@/lib/products/queries";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductCatalogTerminal } from "@/components/products/product-catalog-terminal";

export default async function ItemsPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  if (!snapshot.isOnboardingComplete) redirect("/onboarding");

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;

  const [products, categories, catalogContext, approvalAlertCount, operatorProfile] =
    await Promise.all([
      fetchProductListRows(supabase, tenantId),
      fetchCategoryRows(supabase, tenantId),
      fetchProductCatalogContext(supabase, tenantId),
      fetchApprovalAlertCount(supabase, tenantId),
      fetchOperatorProfileForSession(supabase, orgName),
    ]);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
    >
      <ProductCatalogTerminal
        initialProducts={products}
        categories={categories}
        catalogContext={catalogContext}
      />
    </DashboardShell>
  );
}
