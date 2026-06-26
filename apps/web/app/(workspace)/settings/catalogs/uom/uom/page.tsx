import { UomManagementTerminal } from "@/components/inventory/uom/uom-management-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveUomManagementAccess } from "@/lib/uom/access";
import { fetchUomRows } from "@/lib/uom/queries";

export default async function UomManagementPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [rows, access] = await Promise.all([
    fetchUomRows(supabase, tenantId),
    resolveUomManagementAccess(supabase, userId, tenantId),
  ]);

  return <UomManagementTerminal initialRows={rows} canManage={access.canManage} />;
}
