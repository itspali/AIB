import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import { resolveProductFieldPermissions } from "@/lib/products/field-permissions-server";
import { loadUserProductListPrefs } from "@/lib/products/list-prefs-server";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const operatorProfile = await fetchOperatorProfileForSession(supabase, orgName);

  const fieldPermissions = await resolveProductFieldPermissions(
    supabase,
    tenantId,
    operatorProfile?.role ?? "STAFF"
  );

  const initialListPrefs =
    user != null ? await loadUserProductListPrefs(supabase, user.id, tenantId) : null;

  const [products, categories, catalogContext, approvalAlertCount] = await Promise.all([
    fetchProductListRows(supabase, tenantId, fieldPermissions),
    fetchCategoryRows(supabase, tenantId),
    fetchProductCatalogContext(supabase, tenantId),
    fetchApprovalAlertCount(supabase, tenantId),
  ]);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ProductCatalogTerminal
        tenantId={tenantId}
        initialProducts={products}
        categories={categories}
        catalogContext={catalogContext}
        fieldPermissions={fieldPermissions}
        initialListPrefs={initialListPrefs}
      />
    </DashboardShell>
  );
}
