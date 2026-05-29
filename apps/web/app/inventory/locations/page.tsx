import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveLocationManagementAccess } from "@/lib/locations/access";
import { fetchLocationModuleContext, fetchLocationRows } from "@/lib/locations/queries";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LocationManagementTerminal } from "@/components/locations/location-management-terminal";

export default async function LocationsPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");
  if (!snapshot.isOnboardingComplete) redirect("/onboarding");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;

  const access = await resolveLocationManagementAccess(supabase, user.id, tenantId);

  const [rows, moduleContext, approvalAlertCount, operatorProfile] = await Promise.all([
    fetchLocationRows(supabase, tenantId),
    fetchLocationModuleContext(supabase, tenantId, access.canManage),
    fetchApprovalAlertCount(supabase, tenantId),
    fetchOperatorProfileForSession(supabase, orgName),
  ]);

  if (!moduleContext) redirect("/signup");

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <LocationManagementTerminal initialRows={rows} moduleContext={moduleContext} />
    </DashboardShell>
  );
}
