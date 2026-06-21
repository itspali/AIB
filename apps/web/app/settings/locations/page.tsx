import { redirect } from "next/navigation";
import { LocationManagementTerminalLazy } from "@/components/locations/location-management-terminal-lazy";
import { resolveLocationManagementAccess } from "@/lib/locations/access";
import { fetchLocationModuleContext, fetchLocationRows } from "@/lib/locations/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function LocationsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const access = await resolveLocationManagementAccess(supabase, userId, tenantId);

  const [rows, moduleContext] = await Promise.all([
    fetchLocationRows(supabase, tenantId),
    fetchLocationModuleContext(supabase, tenantId, access.canManage),
  ]);

  if (!moduleContext) redirect("/signup");

  return <LocationManagementTerminalLazy initialRows={rows} moduleContext={moduleContext} />;
}
