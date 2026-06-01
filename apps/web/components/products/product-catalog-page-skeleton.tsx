import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATALOG_VIEWPORT_OFFSET = "-mt-2 md:-mt-3 lg:-mt-4";

const CATALOG_PAGE_CHROME =
  "z-20 shrink-0 border-b border-border/80 bg-background -mx-4 px-4 pt-2 pb-0.5 md:-mx-6 md:px-6 md:pt-2.5 md:pb-1 lg:-mx-8 lg:px-8 lg:pt-3";

export function ProductCatalogPageSkeleton() {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        CATALOG_VIEWPORT_OFFSET
      )}
      aria-busy="true"
      aria-label="Loading items catalog"
    >
      <div className={CATALOG_PAGE_CHROME}>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <Skeleton className="h-7 w-24 shimmer" />
            <Skeleton className="h-8 w-16 shrink-0 rounded-md shimmer" />
          </div>
          <Skeleton className="h-7 w-full max-w-md shimmer" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ProductListSkeleton viewMode="table" />
      </div>
    </div>
  );
}
