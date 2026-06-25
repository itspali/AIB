import { Suspense } from "react";
import { CategoryCatalogLoader } from "@/components/categories/category-catalog-loader";
import { CategoryCatalogPageSkeleton } from "@/components/categories/category-catalog-page-skeleton";
import { ListWorkspaceProvider } from "@/lib/layout/list-workspace";

export default function ItemsCategoriesPage() {
  return (
    <ListWorkspaceProvider moduleId="categories">
      <Suspense fallback={<CategoryCatalogPageSkeleton />}>
        <CategoryCatalogLoader />
      </Suspense>
    </ListWorkspaceProvider>
  );
}
