import { Skeleton } from "@/components/ui/skeleton";

export function CategoryFormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full shimmer" />
      <Skeleton className="h-10 w-full shimmer" />
      <Skeleton className="h-6 w-24 shimmer" />
      <Skeleton className="h-10 w-full shimmer" />
    </div>
  );
}
