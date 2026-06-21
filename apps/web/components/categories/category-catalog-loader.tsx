import dynamic from "next/dynamic";
import { CategoryCatalogPageSkeleton } from "@/components/categories/category-catalog-page-skeleton";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchDefaultCustomModuleView } from "@/lib/search/views/queries";
import { toSavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

const CategoryManagementTerminal = dynamic(
  () =>
    import("@/components/categories/category-management-terminal").then(
      (module) => module.CategoryManagementTerminal
    ),
  { loading: () => <CategoryCatalogPageSkeleton /> }
);

export async function CategoryCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();
  const defaultView = await fetchDefaultCustomModuleView(
    supabase,
    tenantId,
    userId,
    "categories"
  );

  const initialSavedView: SavedViewSnapshot | null = defaultView
    ? toSavedViewSnapshot(defaultView)
    : null;

  return (
    <CategoryManagementTerminal initialRows={[]} initialSavedView={initialSavedView} />
  );
}
