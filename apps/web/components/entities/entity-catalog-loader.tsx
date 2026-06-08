import { EntityManagementTerminal } from "@/components/entities/entity-management-terminal";
import { fetchEntityListPage } from "@/lib/entities/list-queries";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type { EntityWorkspace } from "@/lib/entities/types";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchDefaultCustomModuleView } from "@/lib/search/views/queries";
import { toSavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

type Props = {
  workspace: EntityWorkspace;
};

export async function EntityCatalogLoader({ workspace }: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [page, defaultView] = await Promise.all([
    fetchEntityListPage(supabase, workspace),
    fetchDefaultCustomModuleView(supabase, tenantId, userId, config.savedViewModuleKey),
  ]);

  const initialSavedView: SavedViewSnapshot | null = defaultView
    ? toSavedViewSnapshot(defaultView)
    : null;

  return (
    <EntityManagementTerminal
      workspace={workspace}
      tenantId={tenantId}
      initialRows={page.rows}
      initialTotalCount={page.totalCount}
      initialSavedView={initialSavedView}
    />
  );
}
