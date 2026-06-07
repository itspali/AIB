import { fetchCategoryRows } from "@/lib/categories/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchDefaultCustomModuleView } from "@/lib/search/views/queries";
import { toSavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";
import { CategoryManagementTerminal } from "@/components/categories/category-management-terminal";

export async function CategoryCatalogLoader() {
  const { supabase, tenantId, userId } = await getModulePageContext();
  const [rows, defaultView] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    fetchDefaultCustomModuleView(supabase, tenantId, userId, "categories"),
  ]);

  const initialSavedView: SavedViewSnapshot | null = defaultView
    ? toSavedViewSnapshot(defaultView)
    : null;

  return (
    <CategoryManagementTerminal
      initialRows={rows}
      initialSavedView={initialSavedView}
    />
  );
}
