import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CategoryManagementTerminal } from "@/components/categories/category-management-terminal";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  if (!snapshot.isOnboardingComplete) redirect("/onboarding");

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;

  const [rows, approvalAlertCount, operatorProfile] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    fetchApprovalAlertCount(supabase, tenantId),
    fetchOperatorProfileForSession(supabase, orgName),
  ]);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
    >
      <CategoryManagementTerminal initialRows={rows} />
    </DashboardShell>
  );
}
