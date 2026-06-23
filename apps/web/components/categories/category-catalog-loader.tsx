import dynamic from "next/dynamic";
import { CategoryCatalogPageSkeleton } from "@/components/categories/category-catalog-page-skeleton";
import { fetchCategoryRows } from "@/lib/categories/queries";
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
  const [defaultView, initialRows] = await Promise.all([
    fetchDefaultCustomModuleView(supabase, tenantId, userId, "categories"),
    fetchCategoryRows(supabase, tenantId),
  ]);

  const initialSavedView: SavedViewSnapshot | null = defaultView
    ? toSavedViewSnapshot(defaultView)
    : null;

  return (
    <CategoryManagementTerminal
      initialRows={initialRows}
      initialSavedView={initialSavedView}
    />
  );
}
