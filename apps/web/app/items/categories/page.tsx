import { Suspense } from "react";
import { CategoryCatalogLoader } from "@/components/categories/category-catalog-loader";
import { CategoryCatalogPageSkeleton } from "@/components/categories/category-catalog-page-skeleton";

export default function ItemsCategoriesPage() {
  return (
    <Suspense fallback={<CategoryCatalogPageSkeleton />}>
      <CategoryCatalogLoader />
    </Suspense>
  );
}
