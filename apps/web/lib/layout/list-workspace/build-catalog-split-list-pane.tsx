import type { ReactNode } from "react";
import { ListWorkspaceCatalogSplitFeed } from "@/components/layout/list-workspace-catalog-split-feed";
import type { DocumentSplitFeedRow } from "@/components/layout/list-workspace-document-split-feed";

type BulkProps = {
  bulkEnabled?: boolean;
  bulkSelectedIds?: Set<string>;
  pageAllSelected?: boolean;
  pageSomeSelected?: boolean;
  onBulkRowToggle?: (id: string, checked: boolean) => void;
  onBulkPageToggle?: (checked: boolean) => void;
};

type BuildSplitListPaneOptions<T> = BulkProps & {
  rows: readonly T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mapRow: (row: T) => DocumentSplitFeedRow;
  emptyMessage?: string;
  footer?: ReactNode;
  loading?: ReactNode;
  empty?: ReactNode;
  filteredEmpty?: ReactNode;
  hasAnyData: boolean;
};

/** Builds split-pane list content matching Items master-feed + footer structure. */
export function buildCatalogSplitListPane<T>({
  rows,
  selectedId,
  onSelect,
  mapRow,
  emptyMessage,
  footer,
  loading,
  empty,
  filteredEmpty,
  hasAnyData,
  bulkEnabled,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  onBulkRowToggle,
  onBulkPageToggle,
}: BuildSplitListPaneOptions<T>): ReactNode {
  if (loading) return loading;
  if (!hasAnyData && empty) return empty;
  if (rows.length === 0) {
    if (filteredEmpty) return filteredEmpty;
    return (
      <ListWorkspaceCatalogSplitFeed
        rows={[]}
        selectedId={selectedId}
        onSelect={onSelect}
        mapRow={mapRow}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ListWorkspaceCatalogSplitFeed
        rows={rows}
        selectedId={selectedId}
        onSelect={onSelect}
        mapRow={mapRow}
        emptyMessage={emptyMessage}
        bulkEnabled={bulkEnabled}
        bulkSelectedIds={bulkSelectedIds}
        pageAllSelected={pageAllSelected}
        pageSomeSelected={pageSomeSelected}
        onBulkRowToggle={onBulkRowToggle}
        onBulkPageToggle={onBulkPageToggle}
      />
      {footer}
    </div>
  );
}
