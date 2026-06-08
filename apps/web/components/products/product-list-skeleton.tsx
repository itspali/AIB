import { Skeleton } from "@/components/ui/skeleton";
import {
  isCardViewMode,
  isShopCardLayout,
  type ProductCardLayout,
  type ProductListViewMode,
} from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  viewMode: ProductListViewMode;
  cardLayout?: ProductCardLayout;
};

function CardSkeletonStructured() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <article
          key={index}
          className="flex min-h-[7.5rem] flex-col gap-2 rounded-xl border border-border p-3 sm:p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-lg sm:h-16 sm:w-16" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        </article>
      ))}
    </>
  );
}

function CardSkeletonShop() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <article
          key={index}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <Skeleton className="aspect-[4/5] w-full rounded-none sm:aspect-square" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </article>
      ))}
    </>
  );
}

function cardSkeletonForLayout(cardLayout: ProductCardLayout) {
  if (cardLayout === "shop") return <CardSkeletonShop />;
  return <CardSkeletonStructured />;
}

export function ProductListSkeleton({ viewMode, cardLayout = "v2" }: Props) {
  if (isCardViewMode(viewMode)) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2",
          isShopCardLayout(cardLayout) ? "gap-4" : "gap-3"
        )}
        aria-busy="true"
        aria-label="Loading product list"
      >
        {cardSkeletonForLayout(cardLayout)}
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col border border-border bg-muted/20 shadow-sm"
      aria-busy="true"
      aria-label="Loading product list"
    >
      <Skeleton className="h-8 w-full rounded-none shimmer" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-10 w-full rounded-none"
        />
      ))}
    </div>
  );
}
