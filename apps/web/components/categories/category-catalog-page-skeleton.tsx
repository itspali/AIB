import { Skeleton } from "@/components/ui/skeleton";
import {
  LIST_MODULE_PAGE_CHROME,
  LIST_MODULE_VIEWPORT_OFFSET,
  LIST_WORKSPACE_GLASS_V2_ROOT,
} from "@/lib/layout/list-module-chrome";
import { cn } from "@/lib/utils";

export function CategoryCatalogPageSkeleton() {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        LIST_MODULE_VIEWPORT_OFFSET,
        LIST_WORKSPACE_GLASS_V2_ROOT
      )}
      aria-busy="true"
      aria-label="Loading categories"
    >
      <div className={LIST_MODULE_PAGE_CHROME}>
        <div className="items-unified-catalog-header items-unified-catalog-header--split flex min-h-9 min-w-0 flex-nowrap items-center gap-2 md:gap-2.5">
          <Skeleton className="h-6 w-24 shrink-0 shimmer" />
          <Skeleton className="h-4 w-12 shrink-0 shimmer" />
          <Skeleton className="h-7 min-w-0 flex-1 shimmer" />
          <Skeleton className="h-9 min-w-[12rem] flex-1 shimmer" />
          <Skeleton className="h-8 w-8 shrink-0 rounded-md shimmer" />
        </div>
      </div>
      <div className="revamp-catalog-body flex min-h-0 flex-1 flex-col overflow-hidden p-1">
        <Skeleton className="h-full min-h-[240px] shimmer" />
      </div>
    </div>
  );
}
