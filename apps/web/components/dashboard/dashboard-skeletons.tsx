import { Skeleton } from "@/components/ui/skeleton";

function MetricCardSkeleton() {
  return (
    <div className="overview-kpi-tile surface-panel space-y-3 p-4">
      <Skeleton className="h-3 w-32 shimmer" />
      <Skeleton className="h-8 w-24 shimmer" />
      <Skeleton className="h-3 w-40 shimmer" />
    </div>
  );
}

export function MetricGaugeSkeleton() {
  return (
    <div className="mb-8">
      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-40 shimmer" />
        <Skeleton className="h-3 w-64 shimmer" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    </div>
  );
}

export function WorkspaceStatusSkeleton() {
  return (
    <div className="surface-panel mb-8 space-y-2 p-4">
      <Skeleton className="h-4 w-36 shimmer" />
      <Skeleton className="h-3 w-56 shimmer" />
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="canvas-scroll-endpad" aria-busy="true" aria-label="Loading dashboard">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-3 w-40 shimmer" />
        <Skeleton className="h-8 w-48 shimmer" />
        <Skeleton className="h-4 w-72 shimmer" />
      </div>
      <MetricGaugeSkeleton />
      <div className="mb-8 space-y-2">
        <Skeleton className="h-4 w-36 shimmer" />
        <Skeleton className="h-20 w-full shimmer rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-24 w-full shimmer rounded-lg" />
        <Skeleton className="h-24 w-full shimmer rounded-lg" />
        <Skeleton className="h-24 w-full shimmer rounded-lg" />
        <Skeleton className="h-24 w-full shimmer rounded-lg" />
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="canvas-scroll-endpad" aria-busy="true" aria-label="Loading settings">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-48 shimmer" />
        <Skeleton className="h-4 w-96 max-w-full shimmer" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-12 w-full shimmer rounded-lg" />
        <Skeleton className="h-12 w-full shimmer rounded-lg" />
        <Skeleton className="h-32 w-full shimmer rounded-lg" />
        <Skeleton className="h-12 w-full shimmer rounded-lg" />
      </div>
    </div>
  );
}
