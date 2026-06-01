import { Suspense } from "react";
import { ProductCatalogLoader } from "@/components/products/product-catalog-loader";
import { ProductCatalogPageSkeleton } from "@/components/products/product-catalog-page-skeleton";

export default async function InventoryItemsPage() {
  return (
    <Suspense fallback={<ProductCatalogPageSkeleton />}>
      <ProductCatalogLoader />
    </Suspense>
  );
}
