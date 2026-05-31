import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LocationManagementTerminal } from "@/components/locations/location-management-terminal";
import { resolveLocationManagementAccess } from "@/lib/locations/access";
import { fetchLocationModuleContext, fetchLocationRows } from "@/lib/locations/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function LocationsPage() {
  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const access = await resolveLocationManagementAccess(supabase, userId, tenantId);

  const [rows, moduleContext] = await Promise.all([
    fetchLocationRows(supabase, tenantId),
    fetchLocationModuleContext(supabase, tenantId, access.canManage),
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
