import dynamic from "next/dynamic";
import { EntityCatalogPageSkeleton } from "@/components/entities/entity-catalog-page-skeleton";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { fetchEntityListPage } from "@/lib/entities/list-queries";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type { EntityWorkspace } from "@/lib/entities/types";
import { getModulePageContext } from "@/lib/layout/module-page";
import { readActiveModuleViewIdFromCookie } from "@/lib/search/views/active-module-view-cookie.server";
import { resolveActiveCustomModuleView } from "@/lib/search/views/catalog-view-bootstrap";
import { fetchCustomModuleViewsForUser } from "@/lib/search/views/queries";
import { toSavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

const EntityManagementTerminal = dynamic(
  () =>
    import("@/components/entities/entity-management-terminal").then(
      (module) => module.EntityManagementTerminal
    ),
  { loading: () => <EntityCatalogPageSkeleton /> }
);

type Props = {
  workspace: EntityWorkspace;
};

export async function EntityCatalogLoader({ workspace }: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [page, moduleViews, activeViewIdFromCookie] = await Promise.all([
    fetchEntityListPage(supabase, workspace),
    fetchCustomModuleViewsForUser(supabase, tenantId, userId, config.savedViewModuleKey),
    readActiveModuleViewIdFromCookie(config.savedViewModuleKey),
  ]);

  const activeView = resolveActiveCustomModuleView(moduleViews, activeViewIdFromCookie);
  const initialSavedView: SavedViewSnapshot | null = activeView
    ? toSavedViewSnapshot(activeView)
    : null;

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId={`entities-${workspace}`}>
    <EntityManagementTerminal
      workspace={workspace}
      tenantId={tenantId}
      initialRows={page.rows}
      initialTotalCount={page.totalCount}
      initialHasMore={page.hasMore}
      initialSavedViews={moduleViews}
      initialSavedView={initialSavedView}
    />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
