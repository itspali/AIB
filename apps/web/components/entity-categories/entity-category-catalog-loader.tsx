import dynamic from "next/dynamic";
import { EntityCategoryCatalogPageSkeleton } from "@/components/entity-categories/entity-category-catalog-page-skeleton";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

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
  return <EntityCategoryManagementTerminal workspace={workspace} initialRows={[]} />;
}
