"use client";

import { FilterChipRow } from "@/components/search/filter-chip-row";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  wrapperClassName?: string;
};

export function OmnibarFilterChipBar({ className, wrapperClassName }: Props) {
  const { activeAst, removeClauseAt, activeFilterCount, clearFilters } = useOmnibarContext();
  const chips = activeAst.filter((clause) => clause.kind !== "text");

  if (!chips.length) return null;

  return (
    <div className={cn("border-t border-border/60 px-4 py-1.5 md:px-6", wrapperClassName)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-2xl items-center justify-between gap-3",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Active filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </span>
          <FilterChipRow ast={activeAst} onRemove={removeClauseAt} className="min-w-0 flex-1" />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 text-xs text-muted-foreground"
          onClick={clearFilters}
        >
          Clear all
        </Button>
      </div>
    </div>
  );
}
