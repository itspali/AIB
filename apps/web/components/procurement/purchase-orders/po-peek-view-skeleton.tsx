import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function AddressBlockSkeleton() {
  return (
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-3 w-16 shimmer" />
      <Skeleton className="h-4 w-3/5 max-w-[12rem] shimmer" />
      <Skeleton className="h-3 w-full max-w-[14rem] shimmer" />
      <Skeleton className="h-3 w-4/5 max-w-[11rem] shimmer" />
      <Skeleton className="h-3 w-2/5 max-w-[8rem] shimmer" />
    </div>
  );
}

function HeaderFieldSkeleton() {
  return (
    <div className="min-w-0 space-y-1.5">
      <Skeleton className="h-3 w-20 shimmer" />
      <Skeleton className="h-4 w-3/4 max-w-[10rem] shimmer" />
    </div>
  );
}

function LinesTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_5rem] gap-0 border-b border-border/60 bg-muted/40 px-2 py-2">
        <Skeleton className="mx-auto h-3 w-3 shimmer" />
        <Skeleton className="h-3 w-12 shimmer" />
        <Skeleton className="ml-auto h-3 w-8 shimmer" />
        <Skeleton className="ml-auto h-3 w-10 shimmer" />
        <Skeleton className="ml-auto h-3 w-10 shimmer" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className={cn(
            "grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_5rem] gap-0 border-b border-border/40 px-2 py-2.5 last:border-0",
            index % 2 === 1 && "bg-muted/20"
          )}
        >
          <Skeleton className="mx-auto h-3 w-4 shimmer" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-4/5 max-w-[12rem] shimmer" />
            <Skeleton className="h-3 w-1/2 max-w-[8rem] shimmer" />
          </div>
          <Skeleton className="ml-auto h-3.5 w-8 shimmer" />
          <Skeleton className="ml-auto h-3.5 w-10 shimmer" />
          <Skeleton className="ml-auto h-3.5 w-10 shimmer" />
        </div>
      ))}
    </div>
  );
}

function PromoPanelSkeleton() {
  return (
    <div className="surface-inset rounded-lg border border-border/60 p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-0.5 h-4 w-4 shrink-0 shimmer" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-44 shimmer" />
            <Skeleton className="h-3 w-full max-w-md shimmer" />
          </div>
          <div className="overflow-hidden rounded-md border border-border/60">
            <Skeleton className="h-9 w-full rounded-none shimmer" />
            <Skeleton className="h-12 w-full rounded-none shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PoPeekViewSkeleton({
  className,
  includePromoSection = false,
}: {
  className?: string;
  includePromoSection?: boolean;
}) {
  return (
    <div
      className={cn("space-y-6", className)}
      aria-busy="true"
      aria-label="Loading purchase order"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AddressBlockSkeleton />
        <AddressBlockSkeleton />
      </div>

      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <HeaderFieldSkeleton key={index} />
        ))}
      </div>

      {includePromoSection ? <PromoPanelSkeleton /> : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-10 shimmer" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full shimmer" />
            <Skeleton className="h-4 w-28 shimmer" />
          </div>
        </div>
        <LinesTableSkeleton />
      </div>
    </div>
  );
}
