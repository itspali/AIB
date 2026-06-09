import { fetchEntityCategoryRows } from "@/lib/entity-categories/queries";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import { getModulePageContext } from "@/lib/layout/module-page";
import { EntityCategoryManagementTerminal } from "@/components/entity-categories/entity-category-management-terminal";

type Props = {
  workspace: EntityCategoryWorkspace;
};

export async function EntityCategoryCatalogLoader({ workspace }: Props) {
  const { supabase, tenantId } = await getModulePageContext();
  const rows = await fetchEntityCategoryRows(supabase, tenantId, workspace);

  return <EntityCategoryManagementTerminal workspace={workspace} initialRows={rows} />;
}
