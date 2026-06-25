"use client";

import { useMemo } from "react";
import {
  ListWorkspaceDocumentSplitFeed,
  type DocumentSplitFeedRow,
} from "@/components/layout/list-workspace-document-split-feed";

type BulkProps = {
  bulkEnabled?: boolean;
  bulkSelectedIds?: Set<string>;
  pageAllSelected?: boolean;
  pageSomeSelected?: boolean;
  onBulkRowToggle?: (id: string, checked: boolean) => void;
  onBulkPageToggle?: (checked: boolean) => void;
};

type Props<T> = BulkProps & {
  rows: readonly T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mapRow: (row: T) => DocumentSplitFeedRow;
  emptyMessage?: string;
};

/** Generic compact split feed — Items/Categories master-feed parity for catalog modules. */
export function ListWorkspaceCatalogSplitFeed<T>({
  rows,
  selectedId,
  onSelect,
  mapRow,
  emptyMessage,
  bulkEnabled = false,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  onBulkRowToggle,
  onBulkPageToggle,
}: Props<T>) {
  const feedRows = useMemo(() => rows.map(mapRow), [mapRow, rows]);

  return (
    <ListWorkspaceDocumentSplitFeed
      rows={feedRows}
      selectedId={selectedId}
      onSelect={onSelect}
      emptyMessage={emptyMessage}
      bulkEnabled={bulkEnabled}
      bulkSelectedIds={bulkSelectedIds}
      pageAllSelected={pageAllSelected}
      pageSomeSelected={pageSomeSelected}
      onBulkRowToggle={onBulkRowToggle}
      onBulkPageToggle={onBulkPageToggle}
    />
  );
}
