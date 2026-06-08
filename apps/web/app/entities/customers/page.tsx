import { Suspense } from "react";
import { EntityCatalogLoader } from "@/components/entities/entity-catalog-loader";
import { EntityCatalogPageSkeleton } from "@/components/entities/entity-catalog-page-skeleton";

export default function EntityCustomersPage() {
  return (
    <Suspense fallback={<EntityCatalogPageSkeleton workspace="customer" />}>
      <EntityCatalogLoader workspace="customer" />
    </Suspense>
  );
}
