import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LocationTopologyTerminal } from "@/components/locations/location-topology-terminal";
import { resolveLocationManagementAccess } from "@/lib/locations/access";
import { parseDomRoutingConfig } from "@/lib/locations/dom-routing";
import {
  fetchLocationGovernanceSnapshot,
  fetchLocationModuleContext,
  fetchLocationRows,
  fetchLocationTopologyRows,
} from "@/lib/locations/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function LocationTopologyPage() {
  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const access = await resolveLocationManagementAccess(supabase, userId, tenantId);

  const [topologyRows, locationRows, governance, moduleContext] = await Promise.all([
    fetchLocationTopologyRows(supabase),
    fetchLocationRows(supabase, tenantId),
    fetchLocationGovernanceSnapshot(supabase, tenantId),
    fetchLocationModuleContext(supabase, tenantId, access.canManage),
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
