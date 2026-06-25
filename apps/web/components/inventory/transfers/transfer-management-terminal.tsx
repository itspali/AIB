"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchMoreStockTransfers } from "@/app/inventory/transfers/actions";
import { TransferEmptyState } from "@/components/inventory/transfers/transfer-empty-state";
import { TransferListTable } from "@/components/inventory/transfers/transfer-list-table";
import { TransferListToolbar } from "@/components/inventory/transfers/transfer-list-toolbar";
import { ListLoadMoreFooter } from "@/components/layout/list-load-more-footer";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useDocumentListPagination } from "@/lib/documents/use-document-list-pagination";
import {
  getDefaultTransferListPrefs,
  loadTransferListPrefs,
  saveTransferListPrefs,
  setTransferColumnWidth,
  type TransferListPrefs,
} from "@/lib/inventory/transfers/list-prefs";
import { useActiveTableColumnPrefs } from "@/lib/list-columns/use-active-table-column-prefs";
import {
  TRANSFER_DRAWER_DEST_PARAM,
  TRANSFER_DRAWER_SOURCE_PARAM,
  TRANSFER_STATUS_FILTER_PARAM,
  TRANSFERS_HREF,
} from "@/lib/inventory/transfers/navigation";
import {
  sortTransferListRows,
  type TransferListSortDirection,
  type TransferListSortField,
} from "@/lib/inventory/transfers/list-sort";
import type {
  StockTransferRow,
  StockTransferStatus,
  TransferLocationOption,
} from "@/lib/inventory/transfers/types";
import { useFilteredTransfers } from "@/lib/inventory/transfers/use-filtered-transfers";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapStockTransferRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";

const TransferDrawerForm = lazyClientExport(
  () => import("@/components/inventory/transfers/transfer-drawer-form"),
  "TransferDrawerForm"
);

const TRANSFER_STATUS_FILTER_VALUES = new Set<StockTransferStatus>([
  "DRAFT",
  "PENDING_APPROVAL",
  "DISPATCHED_IN_TRANSIT",
  "RECEIPT_DISCREPANCY",
  "FULLY_COMPLETED",
  "CANCELLED",
]);

function parseTransferStatusFilterParam(value: string | null): StockTransferStatus | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return TRANSFER_STATUS_FILTER_VALUES.has(normalized as StockTransferStatus)
    ? (normalized as StockTransferStatus)
    : null;
}

type Props = {
  initialTransfers: StockTransferRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  locations: TransferLocationOption[];
};

export function TransferManagementTerminal({
  initialTransfers,
  listTotalCount = initialTransfers.length,
  listHasMore = false,
  locations,
}: Props) {
  const searchParams = useSearchParams();
  const initialStatusFilterRef = useRef(
    parseTransferStatusFilterParam(searchParams.get(TRANSFER_STATUS_FILTER_PARAM))
  );
  const drawer = useModuleDrawerUrl(TRANSFERS_HREF, {
    clearParamsOnClose: [TRANSFER_DRAWER_SOURCE_PARAM, TRANSFER_DRAWER_DEST_PARAM],
  });
  const {
    rows: transfers,
    totalCount,
    hasMore,
    isLoadingMore,
    refreshList,
    loadMore,
  } = useDocumentListPagination(
    initialTransfers,
    listTotalCount,
    listHasMore,
    fetchMoreStockTransfers,
    "transfers"
  );
  const [prefs, setPrefs] = useState<TransferListPrefs>(getDefaultTransferListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const { deviceClass, slice: activeColumnPrefs } = useActiveTableColumnPrefs(prefs.columnPrefs);

  useEffect(() => {
    const loaded = loadTransferListPrefs();
    const statusFromUrl = initialStatusFilterRef.current;
    setPrefs(statusFromUrl ? { ...loaded, status: statusFromUrl } : loaded);
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveTransferListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const transfersView = useFilteredTransfers(transfers, prefs);

  const selectedTransferId = drawer.recordId;
  const peekTransfer =
    selectedTransferId != null && drawer.surface === "peek"
      ? (transfers.find((row) => row.id === selectedTransferId) ?? null)
      : null;

  const editTransferId =
    drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const createPrefill = useMemo(() => {
    if (drawer.surface !== "create") return null;

    const variantId = drawer.variantId;
    const sourceLocationId = searchParams.get(TRANSFER_DRAWER_SOURCE_PARAM)?.trim() ?? "";
    const destinationLocationId = searchParams.get(TRANSFER_DRAWER_DEST_PARAM)?.trim() ?? "";

    if (!variantId && !destinationLocationId && !sourceLocationId) return null;

    return {
      source_location_id: sourceLocationId,
      destination_location_id: destinationLocationId,
      variant_id: variantId ?? "",
      variant_sku: "",
      item_name: "",
    };
  }, [drawer.surface, drawer.variantId, searchParams]);

  const handleSelectTransfer = useCallback(
    (transferId: string) => {
      drawer.openPeek(transferId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (transferId: string) => {
      refreshList();
      drawer.afterSave(transferId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (transferId: string) => {
      drawer.openEdit(transferId);
    },
    [drawer]
  );

  const hasAnyData = transfers.length > 0;

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: transfersView.filteredRows,
    extractSearchable: (row) => [
      row.transfer_number,
      row.source_location_name,
      row.destination_location_name,
      row.current_status,
    ],
  });

  const sortedRows = useMemo(
    () =>
      sortTransferListRows(
        feedFilteredRows,
        prefs.sortField,
        prefs.sortDirection
      ),
    [feedFilteredRows, prefs.sortDirection, prefs.sortField]
  );

  const handleSortChange = useCallback(
    (field: TransferListSortField, direction: TransferListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <TransferEmptyState
        onCreate={drawer.openCreate}
        hasLocations={locations.length >= 2}
      />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No transfers match the current filters.
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      <TransferListTable
        rows={sortedRows}
        columnPrefs={activeColumnPrefs}
        sortField={prefs.sortField}
        sortDirection={prefs.sortDirection}
        frozenColumnCount={prefs.frozenColumnCount}
        onSortChange={handleSortChange}
        onColumnWidthChange={(columnId, width) =>
          setPrefs((current) => setTransferColumnWidth(current, deviceClass, columnId, width))
        }
        selectedId={selectedTransferId}
        onSelect={handleSelectTransfer}
      />
      <ListLoadMoreFooter
        visibleCount={transfers.length}
        totalCount={totalCount}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        noun="transfers"
      />
    </div>
  );

  const listFooter = (
    <ListLoadMoreFooter
      visibleCount={transfers.length}
      totalCount={totalCount}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      noun="transfers"
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: sortedRows,
    selectedId: selectedTransferId,
    onSelect: handleSelectTransfer,
    mapRow: mapStockTransferRowToSplitFeed,
    hasAnyData,
    emptyMessage: "No transfers match the current filters.",
    footer: listFooter,
    empty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <TransferEmptyState
          onCreate={drawer.openCreate}
          hasLocations={locations.length >= 2}
        />
      </div>
    ),
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No transfers match the current filters.
        </div>
      </div>
    ),
  });

  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <>
      <ListModuleShell
        surface="classic"
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Transfers"
            count={
              hasAnyData ? `${transfersView.resultCount}/${totalCount}` : undefined
            }
            onNew={drawer.openCreate}
            newAriaLabel="New transfer"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              hasAnyData ? (
                <TransferListToolbar
                  prefs={prefs}
                  onPrefsChange={setPrefs}
                  locations={locations}
                  resultCount={transfersView.resultCount}
                  totalCount={totalCount}
                  compactCountLabel={drawer.isOpen}
                  prefsHydrated={prefsHydrated}
                  hideCount
                />
              ) : undefined
            }
          />
        }
      >
        <ListWorkspaceCatalogBody
          peekOpen={peekOpen}
          splitEmptyTitle="Select a transfer"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      {drawer.isOpen ? (
        <TransferDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface}
          locations={locations}
          peekTransfer={peekTransfer}
          editTransferId={editTransferId}
          createPrefill={createPrefill}
          onClose={drawer.close}
          onAfterSave={handleAfterSave}
          onOpenEdit={handleOpenEdit}
        />
      ) : null}
      </>
    </ListWorkspaceModuleFrame>
  );
}
