"use client";

import { ChevronDown } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listControlShellClassName } from "@/lib/products/list-control-shell";
import { cn } from "@/lib/utils";

export type CategoryBulkToolbarAction = "activate" | "deactivate" | "delete" | "export";

type Props = {
  selectedCount: number;
  totalMatchingCount: number;
  selectAllMatching: boolean;
  pageAllSelected: boolean;
  visibleCount: number;
  isPending: boolean;
  onClearSelection: () => void;
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onAction: (action: CategoryBulkToolbarAction) => void;
  embedded?: boolean;
};

const SELECTION_TRIGGER = "h-7 shrink-0 px-2.5 text-xs shadow-none";

type SelectionScope = "listed" | "all-matching" | "partial";

function resolveSelectionScope(
  selectAllMatching: boolean,
  pageAllSelected: boolean,
  selectedCount: number
): SelectionScope {
  if (selectAllMatching) return "all-matching";
  if (pageAllSelected && selectedCount > 0) return "listed";
  return "partial";
}

function BulkSelectionMenu({
  visibleCount,
  totalMatchingCount,
  selectionScope,
  displayCount,
  isPending,
  onSelectPage,
  onSelectAllMatching,
  onClearSelection,
}: {
  visibleCount: number;
  totalMatchingCount: number;
  selectionScope: SelectionScope;
  displayCount: number;
  isPending: boolean;
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
}) {
  const hasMoreThanListed = totalMatchingCount > visibleCount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={SELECTION_TRIGGER}
          disabled={isPending || visibleCount <= 0}
        >
          Selection
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Select categories for bulk actions
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectionScope === "partial" ? "" : selectionScope}
          onValueChange={(value) => {
            if (value === "listed") onSelectPage();
            if (value === "all-matching") onSelectAllMatching();
          }}
        >
          <DropdownMenuRadioItem value="listed" disabled={visibleCount <= 0}>
            Listed categories ({visibleCount})
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="all-matching" disabled={totalMatchingCount <= 0}>
            All matching categories ({totalMatchingCount})
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {hasMoreThanListed ? (
          <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
            All matching includes categories filtered by your current search.
          </p>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending || displayCount <= 0}
          onClick={() => onClearSelection()}
        >
          Clear selection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CategoryBulkActionToolbar({
  selectedCount,
  totalMatchingCount,
  selectAllMatching,
  pageAllSelected,
  visibleCount,
  isPending,
  onClearSelection,
  onSelectPage,
  onSelectAllMatching,
  onAction,
  embedded = false,
}: Props) {
  const displayCount = selectAllMatching ? totalMatchingCount : selectedCount;
  const selectionScope = resolveSelectionScope(selectAllMatching, pageAllSelected, selectedCount);
  const hasSelection = displayCount > 0;

  if (!hasSelection) return null;

  const selectionLabel = `${displayCount} categor${displayCount === 1 ? "y" : "ies"} selected`;
  const compactSelectionLabel = `${displayCount} selected`;

  return (
    <div
      className={listControlShellClassName(
        cn(
          !embedded && "sticky top-0 z-30",
          "animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--background)))]"
        )
      )}
      role="toolbar"
      aria-label="Bulk category actions"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-tight md:hidden">
              {compactSelectionLabel}
            </p>
            <p className="hidden truncate text-sm font-semibold tracking-tight md:block">
              {selectionLabel}
            </p>
            <BulkSelectionMenu
              visibleCount={visibleCount}
              totalMatchingCount={totalMatchingCount}
              selectionScope={selectionScope}
              displayCount={displayCount}
              isPending={isPending}
              onSelectPage={onSelectPage}
              onSelectAllMatching={onSelectAllMatching}
              onClearSelection={onClearSelection}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isPending ? (
            <Spinner className="text-muted-foreground" label="Processing bulk action" />
          ) : null}
          <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden h-7 px-2.5 text-xs sm:inline-flex"
                disabled={isPending}
                onClick={() => onAction("activate")}
              >
                Activate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden h-7 px-2.5 text-xs sm:inline-flex"
                disabled={isPending}
                onClick={() => onAction("deactivate")}
              >
                Deactivate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden h-7 px-2.5 text-xs sm:inline-flex"
                disabled={isPending}
                onClick={() => onAction("export")}
              >
                Export
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="hidden h-7 px-2.5 text-xs sm:inline-flex"
                disabled={isPending}
                onClick={() => onAction("delete")}
              >
                Delete
              </Button>
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="outline" disabled={isPending}>
                      Actions
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onAction("activate")}>Activate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("deactivate")}>
                      Deactivate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("export")}>Export selected</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onAction("delete")}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
        </div>
      </div>
    </div>
  );
}
