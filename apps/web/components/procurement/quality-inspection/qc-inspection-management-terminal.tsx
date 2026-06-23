"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMoreQcInspectionQueueRows } from "@/app/(workspace)/procurement/quality-inspection/actions";
import { QcInspectionBulkToolbar } from "@/components/procurement/quality-inspection/qc-inspection-bulk-toolbar";
import { QcInspectionDrawerForm } from "@/components/procurement/quality-inspection/qc-inspection-drawer-form";
import { QcInspectionEmptyState } from "@/components/procurement/quality-inspection/qc-inspection-empty-state";
import { QcInspectionListTable } from "@/components/procurement/quality-inspection/qc-inspection-list-table";
import { QcInspectionListToolbar } from "@/components/procurement/quality-inspection/qc-inspection-list-toolbar";
import { ListLoadMoreFooter } from "@/components/layout/list-load-more-footer";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { useDocumentListPagination } from "@/lib/documents/use-document-list-pagination";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  getDefaultQcQueueListPrefs,
  loadQcQueueListPrefs,
  saveQcQueueListPrefs,
  setQcQueueColumnWidth,
  type QcQueueListPrefs,
} from "@/lib/procurement/quality-inspection/list-prefs";
import {
  sortQcQueueListRows,
  type QcQueueListSortDirection,
  type QcQueueListSortField,
} from "@/lib/procurement/quality-inspection/list-sort";
import { useFilteredQcQueueRows } from "@/lib/procurement/quality-inspection/use-filtered-qc-queue";
import { PROCUREMENT_QC_INSPECTION_HREF } from "@/lib/procurement/navigation";
import type { QcInspectionQueueRow } from "@/lib/procurement/quality-inspection/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";

const PAGE_DESCRIPTION =
  "Inspect goods receipt lines held in QC quarantine — record test results and post pass or reject quantities to stock.";

type Props = {
  initialRows: QcInspectionQueueRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  locations: ProcurementLocationOption[];
  qcModuleEnabled: boolean;
};

export function QcInspectionManagementTerminal({
  initialRows,
  listTotalCount = initialRows.length,
  listHasMore = false,
  locations,
  qcModuleEnabled,
}: Props) {
  const drawer = useModuleDrawerUrl(PROCUREMENT_QC_INSPECTION_HREF);
  const [prefs, setPrefs] = useState<QcQueueListPrefs>(getDefaultQcQueueListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchMore = useCallback(
    (offset: number) => fetchMoreQcInspectionQueueRows(offset, prefs.locationId),
    [prefs.locationId]
  );

  const {
    rows: queueRows,
    totalCount,
    hasMore,
    isLoadingMore,
    refreshList,
    loadMore,
  } = useDocumentListPagination(
    initialRows,
    listTotalCount,
    listHasMore,
    fetchMore,
    "QC lines"
  );

  useEffect(() => {
    const loaded = loadQcQueueListPrefs();
    if (loaded.locationId && !locations.some((location) => location.id === loaded.locationId)) {
      loaded.locationId = null;
    }
    setPrefs(loaded);
    setPrefsHydrated(true);
  }, [locations]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveQcQueueListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const queueView = useFilteredQcQueueRows(queueRows, prefs, searchQuery);
  const sortedRows = useMemo(
    () => sortQcQueueListRows(queueView.filteredRows, prefs.sortField, prefs.sortDirection),
    [queueView.filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const selectedId = drawer.recordId;
  const peekRow =
    selectedId != null && drawer.surface === "peek"
      ? (queueRows.find((row) => row.id === selectedId) ?? null)
      : null;

  const pageAllSelected =
    sortedRows.length > 0 && sortedRows.every((row) => selectedIds.has(row.id));

  const handleSelect = useCallback(
    (goodsReceiptItemId: string) => {
      drawer.openPeek(goodsReceiptItemId);
    },
    [drawer]
  );

  const handleToggleSelected = useCallback((goodsReceiptItemId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(goodsReceiptItemId);
      else next.delete(goodsReceiptItemId);
      return next;
    });
  }, []);

  const handleTogglePageSelected = useCallback(
    (checked: boolean) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const row of sortedRows) {
          if (checked) next.add(row.id);
          else next.delete(row.id);
        }
        return next;
      });
    },
    [sortedRows]
  );

  const handleAfterInspection = useCallback(async () => {
    setSelectedIds(new Set());
    await refreshList();
  }, [refreshList]);

  const hasAnyData = queueRows.length > 0;

  const listPrimary = !hasAnyData ? (
    <QcInspectionEmptyState />
  ) : sortedRows.length === 0 ? (
    <p className="p-4 text-sm text-muted-foreground">No lines match the current filters.</p>
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      <QcInspectionListTable
        rows={sortedRows}
        columnPrefs={prefs.columnPrefs}
        sortField={prefs.sortField}
        sortDirection={prefs.sortDirection}
        frozenColumnCount={prefs.frozenColumnCount}
        onSortChange={(field: QcQueueListSortField, direction: QcQueueListSortDirection) =>
          setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }))
        }
        onColumnWidthChange={(columnId, width) =>
          setPrefs((current) => setQcQueueColumnWidth(current, columnId, width))
        }
        selectedId={selectedId}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onToggleSelected={handleToggleSelected}
        onTogglePageSelected={handleTogglePageSelected}
        pageAllSelected={pageAllSelected}
      />
      <ListLoadMoreFooter
        visibleCount={sortedRows.length}
        totalCount={totalCount}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        noun="QC lines"
      />
    </div>
  );

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Quality inspection"
            description={PAGE_DESCRIPTION}
            createLabel=""
          />
        }
        toolbar={
          hasAnyData ? (
            <QcInspectionListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              locations={locations}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              resultCount={queueView.filteredCount}
              totalCount={totalCount}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
        bulkToolbar={
          <QcInspectionBulkToolbar
            selectedIds={[...selectedIds]}
            onClearSelection={() => setSelectedIds(new Set())}
            onCompleted={handleAfterInspection}
          />
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          {!qcModuleEnabled ? (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              QC before stocking is disabled in procurement settings. Lines may still appear here if
              they were routed to QC hold before the policy changed.
            </div>
          ) : null}
          {listPrimary}
        </div>
      </ListModuleShell>

      <QcInspectionDrawerForm
        open={drawer.surface === "peek"}
        goodsReceiptItemId={selectedId}
        peekRow={peekRow}
        onOpenChange={(open) => {
          if (!open) drawer.close();
        }}
        onCompleted={handleAfterInspection}
      />
    </>
  );
}
