import { Suspense } from "react";
import { EntityCatalogLoader } from "@/components/entities/entity-catalog-loader";
import { EntityCatalogPageSkeleton } from "@/components/entities/entity-catalog-page-skeleton";

export default function ProcurementSuppliersPage() {
  return (
    <Suspense fallback={<EntityCatalogPageSkeleton workspace="supplier" />}>
      <EntityCatalogLoader workspace="supplier" />
    </Suspense>
  );
}
