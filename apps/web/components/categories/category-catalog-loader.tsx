import dynamic from "next/dynamic";
import { CategoryCatalogPageSkeleton } from "@/components/categories/category-catalog-page-skeleton";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { readActiveModuleViewIdFromCookie } from "@/lib/search/views/active-module-view-cookie.server";
import { resolveActiveCustomModuleView } from "@/lib/search/views/catalog-view-bootstrap";
import { fetchCustomModuleViewsForUser } from "@/lib/search/views/queries";
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
  const [moduleViews, initialRows, activeViewIdFromCookie] = await Promise.all([
    fetchCustomModuleViewsForUser(supabase, tenantId, userId, "categories"),
    fetchCategoryRows(supabase, tenantId),
    readActiveModuleViewIdFromCookie("categories"),
  ]);

  const activeView = resolveActiveCustomModuleView(moduleViews, activeViewIdFromCookie);
  const initialSavedView: SavedViewSnapshot | null = activeView
    ? toSavedViewSnapshot(activeView)
    : null;

  return (
    <CategoryManagementTerminal
      initialRows={initialRows}
      initialSavedViews={moduleViews}
      initialSavedView={initialSavedView}
    />
  );
}
