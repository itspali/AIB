import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  viewMode: "table" | "compact";
};

export function ProductListSkeleton({ viewMode }: Props) {
  if (viewMode === "compact") {
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
    <div className="space-y-2 rounded-lg border border-border p-3" aria-busy="true" aria-label="Loading product list">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
