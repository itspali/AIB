import { HubPanel } from "@/components/dashboard/hub-panel";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCardSkeleton() {
  return (
    <HubPanel accent="cyan">
      <div className="space-y-3 p-6">
        <Skeleton className="h-4 w-40 shimmer" />
        <Skeleton className="ml-auto h-9 w-36 shimmer" />
        <Skeleton className="ml-auto h-3 w-48 shimmer" />
      </div>
    </HubPanel>
  );
}

export function MetricGaugeSkeleton() {
  return (
    <div className="mb-10">
      <div className="mb-5 flex gap-3">
        <Skeleton className="h-7 w-7 rounded-lg shimmer" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48 shimmer" />
          <Skeleton className="h-3 w-64 shimmer" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    </div>
  );
}

export function ControlPanelSkeleton() {
  return (
    <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
      <HubPanel accent="cyan">
        <div className="space-y-3 p-6">
          <Skeleton className="h-5 w-56 shimmer" />
          <Skeleton className="h-12 w-full shimmer" />
        </div>
      </HubPanel>
      <HubPanel accent="amber">
        <div className="space-y-3 p-6">
          <Skeleton className="h-5 w-56 shimmer" />
          <Skeleton className="h-10 w-full shimmer" />
        </div>
      </HubPanel>
    </div>
  );
}

export function TaxPolicyGridSkeleton() {
  return (
    <HubPanel accent="violet">
      <div className="space-y-3 p-6">
        <Skeleton className="h-5 w-48 shimmer" />
        <Skeleton className="h-10 w-full shimmer" />
        <Skeleton className="h-10 w-full shimmer" />
        <Skeleton className="h-10 w-full shimmer" />
      </div>
    </HubPanel>
  );
}
