"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { LIST_WORKSPACE_BULK_CHECKBOX_CLASS } from "@/lib/layout/list-table-chrome";
import { cn } from "@/lib/utils";

export type DocumentSplitFeedRow = {
  id: string;
  /** Mono identifier (SKU, PO #, voucher, …). */
  code: string;
  /** Primary label (name, supplier, …). */
  title: string;
  meta?: string;
  trailing?: string;
  inactive?: boolean;
};

type Props = {
  rows: DocumentSplitFeedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
  bulkEnabled?: boolean;
  bulkSelectedIds?: Set<string>;
  onBulkRowToggle?: (id: string, checked: boolean) => void;
  onBulkPageToggle?: (checked: boolean) => void;
  pageAllSelected?: boolean;
  pageSomeSelected?: boolean;
  leadingSlot?: ReactNode;
};

function DocumentSplitFeedCard({
  row,
  active,
  bulkEnabled,
  bulkSelected,
  onBulkToggle,
  onSelect,
}: {
  row: DocumentSplitFeedRow;
  active: boolean;
  bulkEnabled: boolean;
  bulkSelected: boolean;
  onBulkToggle?: (checked: boolean) => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "spatial-master-card-row flex items-start gap-2",
        row.inactive && "spatial-master-card-row--inactive",
        active && "spatial-master-card-row--active"
      )}
    >
      {bulkEnabled ? (
        <div
          className="spatial-master-card-checkbox flex shrink-0 items-center pt-3 pl-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
            checked={bulkSelected}
            onCheckedChange={(checked) => onBulkToggle?.(checked === true)}
            aria-label={`Select ${row.title}`}
          />
        </div>
      ) : null}
      <button
        type="button"
        className={cn(
          "spatial-master-card min-w-0 flex-1 text-left",
          row.inactive && "spatial-master-card--inactive",
          active && "spatial-master-card--active"
        )}
        onClick={onSelect}
      >
        <div className="spatial-card-top-row">
          <span className="spatial-card-id truncate">{row.code}</span>
          {row.trailing ? <span className="spatial-card-value truncate">{row.trailing}</span> : null}
        </div>
        <span className="spatial-card-name block truncate">{row.title}</span>
        {row.meta ? <span className="spatial-card-meta block truncate">{row.meta}</span> : null}
      </button>
    </div>
  );
}

/** Items-master compact feed for document list modules in split layout. */
export function ListWorkspaceDocumentSplitFeed({
  rows,
  selectedId,
  onSelect,
  emptyMessage = "No records match the current filters.",
  bulkEnabled = false,
  bulkSelectedIds,
  onBulkRowToggle,
  onBulkPageToggle,
  pageAllSelected = false,
  pageSomeSelected = false,
  leadingSlot,
}: Props) {
  const showBulk = bulkEnabled && bulkSelectedIds && onBulkRowToggle;

  return (
    <div className="spatial-master-feed-pane">
      {leadingSlot}
      <div className="spatial-feed-scroll pt-2">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          rows.map((row) => (
            <DocumentSplitFeedCard
              key={row.id}
              row={row}
              active={selectedId === row.id}
              bulkEnabled={Boolean(showBulk)}
              bulkSelected={showBulk ? bulkSelectedIds.has(row.id) : false}
              onBulkToggle={
                showBulk ? (checked) => onBulkRowToggle!(row.id, checked) : undefined
              }
              onSelect={() => onSelect(row.id)}
            />
          ))
        )}
      </div>
      {showBulk && onBulkPageToggle ? (
        <div className="shrink-0 border-t border-[var(--lw-border-glow)] px-2 py-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
              checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => onBulkPageToggle(checked === true)}
              aria-label="Select all on page"
            />
            Select page
          </label>
        </div>
      ) : null}
    </div>
  );
}
