import { Skeleton } from "@/components/ui/skeleton";

export function OnboardingStepSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading setup step">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    </div>
  );
}
