import { CatalogSubNav } from "@/components/products/catalog-sub-nav";
import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductCatalogPageSkeleton() {
  return (
    <div className="canvas-scroll-endpad" aria-busy="true" aria-label="Loading items catalog">
      <header className="mb-4 sm:mb-5 md:mb-5">
        <CatalogSubNav active="items" className="mb-3 mt-0" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-32 shimmer" />
          <Skeleton className="h-10 w-20 shrink-0 rounded-md shimmer" />
        </div>
      </header>
      <div className="mb-4 space-y-3">
        <Skeleton className="h-10 w-full max-w-xl shimmer" />
        <Skeleton className="h-9 w-full max-w-md shimmer" />
      </div>
      <ProductListSkeleton viewMode="table" />
    </div>
  );
}
