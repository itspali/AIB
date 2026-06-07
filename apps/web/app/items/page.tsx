import { Suspense } from "react";
import { ProductCatalogLoader } from "@/components/products/product-catalog-loader";
import { ProductCatalogPageSkeleton } from "@/components/products/product-catalog-page-skeleton";

/** Drawer `id`/`variant` are client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function ItemsCatalogPage() {
  return (
    <Suspense fallback={<ProductCatalogPageSkeleton />}>
      <ProductCatalogLoader />
    </Suspense>
  );
}
