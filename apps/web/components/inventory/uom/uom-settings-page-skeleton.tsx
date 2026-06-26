import { Skeleton } from "@/components/ui/skeleton";
import {
  LIST_MODULE_PAGE_CHROME,
  LIST_MODULE_VIEWPORT_OFFSET,
  LIST_WORKSPACE_GLASS_V2_ROOT,
} from "@/lib/layout/list-module-chrome";
import { cn } from "@/lib/utils";

export function UomSettingsPageSkeleton() {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        LIST_MODULE_VIEWPORT_OFFSET,
        LIST_WORKSPACE_GLASS_V2_ROOT
      )}
      aria-busy="true"
      aria-label="Loading units of measure"
    >
      <div className={LIST_MODULE_PAGE_CHROME}>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <Skeleton className="h-7 w-44 shimmer" />
            <Skeleton className="h-8 w-28 shrink-0 rounded-md shimmer" />
          </div>
          <Skeleton className="hidden h-4 w-full max-w-xl md:block shimmer" />
        </div>
        <Skeleton className="mt-4 h-9 w-full max-w-3xl shimmer" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">
        <Skeleton className="h-full min-h-[240px] shimmer" />
      </div>
    </div>
  );
}
