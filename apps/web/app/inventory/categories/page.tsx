import { Suspense } from "react";
import { CategoryCatalogPageSkeleton } from "@/components/categories/category-catalog-page-skeleton";
import { CategoryManagementTerminal } from "@/components/categories/category-management-terminal";import { fetchCategoryItemCounts, fetchCategoryRows } from "@/lib/categories/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function InventoryCategoriesPage() {
  const { supabase, tenantId } = await getModulePageContext();
  const [rows, itemCountByCategoryId] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    fetchCategoryItemCounts(supabase, tenantId),
  ]);

  return (
    <Suspense fallback={<CategoryCatalogPageSkeleton />}>
      <CategoryManagementTerminal
        initialRows={rows}
        itemCountByCategoryId={itemCountByCategoryId}
      />
    </Suspense>
  );
}
