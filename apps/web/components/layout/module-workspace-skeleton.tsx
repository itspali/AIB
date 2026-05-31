import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  titleWidth?: string;
  className?: string;
};

export function ModuleWorkspaceSkeleton({ titleWidth = "w-40", className }: Props) {
  return (
    <div
      className={cn("canvas-scroll-endpad", className)}
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between md:mb-5">
        <div className="min-w-0 space-y-2">
          <Skeleton className={cn("h-8 shimmer", titleWidth)} />
          <Skeleton className="h-4 w-full max-w-md shimmer md:hidden" />
        </div>
        <Skeleton className="h-10 w-36 shrink-0 rounded-md shimmer" />
      </header>
      <div className="mb-3 space-y-2">
        <Skeleton className="h-9 w-full max-w-[10rem] shimmer" />
        <Skeleton className="h-8 w-full max-w-lg shimmer" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-0">
        <Skeleton className="h-[420px] rounded-lg shimmer lg:col-span-4 lg:mr-4" />
        <Skeleton className="h-[420px] rounded-lg shimmer lg:col-span-8" />
      </div>
    </div>
  );
}
