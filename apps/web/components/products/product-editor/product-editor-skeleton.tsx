import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level fallback that mirrors the ProductEditorShell layout (summary
 * header, scroll-spy rail, sectioned cards) so navigation to the item form
 * shows instant structure instead of a blank screen.
 */
export function ProductEditorSkeleton() {
  return (
    <div className="canvas-scroll-endpad" aria-busy="true" aria-label="Loading item editor">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-20 shimmer" />
        <Skeleton className="h-8 w-16 shimmer" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Summary header */}
        <div className="surface-panel p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-44 shimmer" />
              <Skeleton className="h-3 w-24 shimmer" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full shimmer" />
              <Skeleton className="h-5 w-16 rounded-full shimmer" />
            </div>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
          {/* Rail */}
          <nav className="hidden space-y-1 lg:block">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full shimmer" />
            ))}
          </nav>

          {/* Sections */}
          <div className="min-w-0 space-y-4">
            {Array.from({ length: 2 }).map((_, cardIndex) => (
              <section
                key={cardIndex}
                className="surface-panel p-4 sm:p-6"
              >
                <Skeleton className="mb-4 h-4 w-40 shimmer" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, fieldIndex) => (
                    <div key={fieldIndex} className="space-y-2">
                      <Skeleton className="h-3 w-24 shimmer" />
                      <Skeleton className="h-10 w-full shimmer" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
