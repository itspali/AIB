import dynamic from "next/dynamic";
import { EntityCategoryCatalogPageSkeleton } from "@/components/entity-categories/entity-category-catalog-page-skeleton";
import { ListWorkspaceCatalogLoaderRoot } from "@/components/layout/list-workspace-catalog-loader-root";
import { fetchEntityCategoryRows } from "@/lib/entity-categories/queries";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import { getModulePageContext } from "@/lib/layout/module-page";

const EntityCategoryManagementTerminal = dynamic(
  () =>
    import("@/components/entity-categories/entity-category-management-terminal").then(
      (module) => module.EntityCategoryManagementTerminal
    ),
  { loading: () => <EntityCategoryCatalogPageSkeleton /> }
);

type Props = {
  workspace: EntityCategoryWorkspace;
};

export async function EntityCategoryCatalogLoader({ workspace }: Props) {
  const { supabase, tenantId } = await getModulePageContext();
  const initialRows = await fetchEntityCategoryRows(supabase, tenantId, workspace);

  return (
    <ListWorkspaceCatalogLoaderRoot moduleId={`entity-categories-${workspace}`}>
    <EntityCategoryManagementTerminal workspace={workspace} initialRows={initialRows} />
    </ListWorkspaceCatalogLoaderRoot>
  );
}
