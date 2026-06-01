import { Skeleton } from "@/components/ui/skeleton";
import type { ProductListViewMode } from "@/lib/products/list-prefs";
import { isCardViewMode } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";
type Props = {
  viewMode: ProductListViewMode;
};

export function ProductListSkeleton({ viewMode }: Props) {
  if (isCardViewMode(viewMode)) {
    return (
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        aria-busy="true"
        aria-label="Loading product list"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-border p-3">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col border border-border bg-muted/20 shadow-sm" aria-busy="true" aria-label="Loading product list">
      <Skeleton className="h-8 w-full rounded-none shimmer" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "w-full rounded-none",
            viewMode === "compact" ? "h-7" : "h-10"
          )}
        />
      ))}
    </div>
  );
}
