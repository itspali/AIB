import { Suspense } from "react";
import { EntityCategoryCatalogLoader } from "@/components/entity-categories/entity-category-catalog-loader";
import { EntityCategoryCatalogPageSkeleton } from "@/components/entity-categories/entity-category-catalog-page-skeleton";

export default function ProcurementSupplierCategoriesPage() {
  return (
    <Suspense fallback={<EntityCategoryCatalogPageSkeleton />}>
      <EntityCategoryCatalogLoader workspace="supplier" />
    </Suspense>
  );
}
