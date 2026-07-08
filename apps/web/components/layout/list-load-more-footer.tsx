"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  noun?: string;
};

export function ListLoadMoreFooter({
  visibleCount,
  totalCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
  noun = "records",
}: Props) {
  if (!hasMore && visibleCount >= totalCount) return null;

  return (
    <div className="list-workspace-load-more-footer flex shrink-0 items-center justify-center gap-3 px-4 py-2.5">
      <p className="text-xs text-muted-foreground">
        Showing {visibleCount.toLocaleString()} of {totalCount.toLocaleString()} {noun}
      </p>
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? (
            <>
              <Spinner className="mr-2 h-3.5 w-3.5" />
              Loading…
            </>
          ) : (
            "Load more"
          )}
        </Button>
      ) : null}
    </div>
  );
}
