import { Skeleton } from "@/components/ui/skeleton";
import {
  LIST_MODULE_PAGE_CHROME,
  LIST_MODULE_VIEWPORT_OFFSET,
} from "@/lib/layout/list-module-chrome";
import { cn } from "@/lib/utils";

export function InvoiceCatalogPageSkeleton() {
  return (
    <div
      className={cn("flex min-h-0 flex-col overflow-hidden", LIST_MODULE_VIEWPORT_OFFSET)}
      aria-busy="true"
      aria-label="Loading sales invoices"
    >
      <div className={LIST_MODULE_PAGE_CHROME}>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <Skeleton className="h-7 w-36 shimmer" />
            <Skeleton className="h-8 w-28 shrink-0 rounded-md shimmer" />
          </div>
          <Skeleton className="h-7 w-full max-w-lg shimmer" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">
        <Skeleton className="h-full min-h-[240px] shimmer" />
      </div>
    </div>
  );
}
