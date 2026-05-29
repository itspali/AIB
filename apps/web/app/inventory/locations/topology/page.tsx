import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveLocationManagementAccess } from "@/lib/locations/access";
import { parseDomRoutingConfig } from "@/lib/locations/dom-routing";
import {
  fetchLocationGovernanceSnapshot,
  fetchLocationModuleContext,
  fetchLocationRows,
  fetchLocationTopologyRows,
} from "@/lib/locations/queries";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LocationTopologyTerminal } from "@/components/locations/location-topology-terminal";

export default async function LocationTopologyPage() {
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

  const [topologyRows, locationRows, governance, moduleContext, approvalAlertCount, operatorProfile] =
    await Promise.all([
      fetchLocationTopologyRows(supabase),
      fetchLocationRows(supabase, tenantId),
      fetchLocationGovernanceSnapshot(supabase, tenantId),
      fetchLocationModuleContext(supabase, tenantId, access.canManage),
      fetchApprovalAlertCount(supabase, tenantId),
      fetchOperatorProfileForSession(supabase, orgName),
    ]);

  if (!moduleContext || !governance) redirect("/signup");

  const domRouting = parseDomRoutingConfig(
    governance.dom_routing,
    governance.central_hq_location_id
  );

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <LocationTopologyTerminal
        topologyRows={topologyRows}
        locationRows={locationRows}
        domRouting={domRouting}
        moduleContext={moduleContext}
      />
    </DashboardShell>
  );
}
