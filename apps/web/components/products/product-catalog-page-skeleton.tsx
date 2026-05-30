import { CatalogSubNav } from "@/components/products/catalog-sub-nav";
import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductCatalogPageSkeleton() {
  return (
    <div className="canvas-scroll-endpad" aria-busy="true" aria-label="Loading items catalog">
      <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between md:mb-5">
        <div className="min-w-0">
          <Skeleton className="h-8 w-32 shimmer" />
          <Skeleton className="mt-2 h-4 w-64 shimmer md:hidden" />
          <CatalogSubNav active="items" />
        </div>
        <Skeleton className="h-10 w-44 shrink-0 rounded-md shimmer" />
      </header>
      <div className="mb-4 space-y-3">
        <Skeleton className="h-10 w-full max-w-xl shimmer" />
        <Skeleton className="h-9 w-full max-w-md shimmer" />
      </div>
      <ProductListSkeleton viewMode="table" />
    </div>
  );
}
