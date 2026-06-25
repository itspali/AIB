"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { bulkApproveSalesOrders, bulkConfirmSalesOrders, fetchMoreSalesOrders } from "@/app/sales/orders/actions";
import { ListLoadMoreFooter } from "@/components/layout/list-load-more-footer";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { SalesBulkActionToolbar } from "@/components/sales/shared/sales-bulk-action-toolbar";
import { SoEmptyState } from "@/components/sales/orders/so-empty-state";
import { SoListTable } from "@/components/sales/orders/so-list-table";
import { SoListToolbar } from "@/components/sales/orders/so-list-toolbar";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { Skeleton } from "@/components/ui/skeleton";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import {
  getDefaultSalesOrderListPrefs,
  loadSalesOrderListPrefs,
  saveSalesOrderListPrefs,
  setSalesOrderColumnWidth,
  type SalesOrderListPrefs,
} from "@/lib/sales/orders/list-prefs";
import { useActiveTableColumnPrefs } from "@/lib/list-columns/use-active-table-column-prefs";
import {
  sortSalesOrderListRows,
  type SalesOrderListSortDirection,
  type SalesOrderListSortField,
} from "@/lib/sales/orders/list-sort";
import {
  SALES_ORDERS_HREF,
  SO_COPY_FROM_PARAM,
  SO_DRAWER_QUOTE_PARAM,
  SO_STATUS_FILTER_PARAM,
} from "@/lib/sales/navigation";
import type { SalesDocumentConversionMode } from "@/lib/sales/document-conversion-settings";
import type { SalesOrderStatus } from "@/lib/sales/orders/types";
import {
  canAmendConfirmedSalesOrder,
  canEditSalesOrderDocument,
} from "@/lib/sales/access";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import { useFilteredSalesOrders } from "@/lib/sales/orders/use-filtered-sales-orders";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { buildModuleHref } from "@/lib/layout/module-drawer-url";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapSalesOrderRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import {
  canUserApproveSalesOrders,
  isSalesOrderApprovableByUser,
  isSalesOrderConfirmableByUser,
} from "@/lib/sales/approval-settings";
import { useDocumentListPagination } from "@/lib/documents/use-document-list-pagination";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";

const SoDrawerForm = lazyClientExport(
  () => import("@/components/sales/orders/so-drawer-form"),
  "SoDrawerForm"
);

function liveSearchParams(fallback: ReturnType<typeof useSearchParams>): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams(fallback.toString());
  return new URLSearchParams(window.location.search);
}

function resolveBulkSalesOrderIds(
  bulkSelectAllMatching: boolean,
  bulkSelectedIds: Set<string>,
  matchingIds: string[]
): string[] {
  if (bulkSelectAllMatching) return matchingIds;
  return [...bulkSelectedIds];
}

type Props = {
  initialSalesOrders: SalesOrderRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  editAccessGranted: boolean;
  allowLineItemDiscounts: boolean;
  allowTransactionDiscounts?: boolean;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  tenantCountry?: string | null;
  gstRegistered?: boolean;
  preferredShippingLocationId?: string | null;
  approvalSettings: SalesApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
  documentConversionMode?: SalesDocumentConversionMode;
};

export function SoManagementTerminal({
  initialSalesOrders,
  listTotalCount = initialSalesOrders.length,
  listHasMore = false,
  locations,
  customers,
  editAccessGranted,
  allowLineItemDiscounts,
  allowTransactionDiscounts = false,
  defaultCurrency,
  documentLayout,
  taxCodeOptions = [],
  tenantCountry = null,
  gstRegistered = false,
  preferredShippingLocationId = null,
  approvalSettings,
  currentUserId,
  isOwner,
  documentConversionMode = "prefill_form",
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(SALES_ORDERS_HREF, {
    clearParamsOnClose: [SO_COPY_FROM_PARAM, SO_DRAWER_QUOTE_PARAM, SO_STATUS_FILTER_PARAM],
  });
  const copyFromId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(SO_COPY_FROM_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);
  const createPrefillQuoteId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(SO_DRAWER_QUOTE_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);
  const {
    rows: salesOrders,
    setRows: setSalesOrders,
    totalCount,
    hasMore,
    isLoadingMore,
    isListBootstrapping,
    refreshList,
    loadMore,
  } = useDocumentListPagination(
    initialSalesOrders,
    listTotalCount,
    listHasMore,
    fetchMoreSalesOrders,
    "sales orders"
  );
  const [prefs, setPrefs] = useState<SalesOrderListPrefs>(getDefaultSalesOrderListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const { deviceClass, slice: activeColumnPrefs } = useActiveTableColumnPrefs(prefs.columnPrefs);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  const canBulkApprove = canUserApproveSalesOrders(currentUserId, approvalSettings, {
    isOwner,
  });
  const canBulkConfirm = editAccessGranted;

  const isRowBulkApprovable = useCallback(
    (row: SalesOrderRow) => {
      if (!canBulkApprove) return false;
      if (isOwner) return row.commercial_status === "PENDING_APPROVAL";
      return isSalesOrderApprovableByUser(row, currentUserId, approvalSettings, { isOwner });
    },
    [approvalSettings, canBulkApprove, currentUserId, isOwner]
  );

  const isRowBulkConfirmable = useCallback(
    (row: SalesOrderRow) =>
      canBulkConfirm &&
      isSalesOrderConfirmableByUser(row, approvalSettings, currentUserId, {
        isOwner,
        editAccessGranted,
      }),
    [approvalSettings, canBulkConfirm, currentUserId, editAccessGranted, isOwner]
  );

  const isRowBulkSelectable = useCallback(
    (row: SalesOrderRow) => isRowBulkApprovable(row) || isRowBulkConfirmable(row),
    [isRowBulkApprovable, isRowBulkConfirmable]
  );

  useEffect(() => {
    setPrefs(loadSalesOrderListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get(SO_STATUS_FILTER_PARAM)?.trim();
    if (!statusParam || statusParam === "all") return;
    setPrefs((current) =>
      current.status === statusParam
        ? current
        : { ...current, status: statusParam as SalesOrderStatus | "all" }
    );
  }, [searchParams]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveSalesOrderListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const ordersView = useFilteredSalesOrders(salesOrders, prefs);

  const selectedId = drawer.recordId;
  const peekOrder =
    selectedId != null && drawer.surface === "peek"
      ? (salesOrders.find((row) => row.id === selectedId) ?? null)
      : null;

  const editOrderId = drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const handleSelect = useCallback(
    (salesOrderId: string) => {
      drawer.openPeek(salesOrderId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (salesOrderId: string) => {
      refreshList();
      drawer.afterSave(salesOrderId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (salesOrderId: string) => {
      const order = salesOrders.find((row) => row.id === salesOrderId);
      const allowEditConfirmed =
        order != null && canAmendConfirmedSalesOrder(order, editAccessGranted);
      if (
        order &&
        !canEditSalesOrderDocument(order.commercial_status, {
          allowEditConfirmed,
          hasEditPermission: editAccessGranted,
        })
      ) {
        drawer.openPeek(salesOrderId);
        return;
      }
      drawer.openEdit(salesOrderId);
    },
    [drawer, editAccessGranted, salesOrders]
  );

  const handleEditNotAllowed = useCallback(
    (salesOrderId: string) => {
      drawer.openPeek(salesOrderId);
    },
    [drawer]
  );

  const handleDuplicate = useCallback(
    (salesOrderId: string) => {
      drawer.openCreate({
        extraParams: { [SO_COPY_FROM_PARAM]: salesOrderId },
      });
    },
    [drawer]
  );

  useEffect(() => {
    if (!editAccessGranted && drawer.surface === "create") {
      drawer.close();
    }
  }, [drawer.surface, drawer.close, editAccessGranted]);

  useEffect(() => {
    if (!editAccessGranted && drawer.surface === "edit") {
      if (drawer.recordId) {
        drawer.openPeek(drawer.recordId);
      } else {
        drawer.close();
      }
    }
  }, [drawer.surface, drawer.recordId, drawer.openPeek, drawer.close, editAccessGranted]);

  const hasAnyData = salesOrders.length > 0;
  const filteredRows = ordersView.filteredRows;

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: filteredRows,
    extractSearchable: (row) => [
      row.voucher_number,
      row.customer_name,
      row.shipping_location_name,
      row.shipping_location_code,
      row.commercial_status,
    ],
  });

  const sortedRows = useMemo(
    () => sortSalesOrderListRows(feedFilteredRows, prefs.sortField, prefs.sortDirection),
    [feedFilteredRows, prefs.sortDirection, prefs.sortField]
  );

  const selectableMatchingIds = useMemo(
    () => filteredRows.filter(isRowBulkSelectable).map((row) => row.id),
    [filteredRows, isRowBulkSelectable]
  );

  const selectableVisibleIds = useMemo(
    () => sortedRows.filter(isRowBulkSelectable).map((row) => row.id),
    [isRowBulkSelectable, sortedRows]
  );

  const pageAllSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => bulkSelectedIds.has(id));
  const pageSomeSelected =
    selectableVisibleIds.some((id) => bulkSelectedIds.has(id)) && !pageAllSelected;

  const bulkSelectionCount = bulkSelectAllMatching
    ? selectableMatchingIds.length
    : bulkSelectedIds.size;

  const showBulkSelectionColumn =
    (canBulkApprove || canBulkConfirm) && selectableMatchingIds.length > 0;

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const resolveSelectedIds = useCallback(
    () => resolveBulkSalesOrderIds(bulkSelectAllMatching, bulkSelectedIds, selectableMatchingIds),
    [bulkSelectAllMatching, bulkSelectedIds, selectableMatchingIds]
  );

  const rowById = useMemo(() => new Map(salesOrders.map((row) => [row.id, row])), [salesOrders]);

  const filterSelectedApprovableIds = useCallback(
    (ids: string[]) =>
      ids.filter((id) => {
        const row = rowById.get(id);
        return row != null && isRowBulkApprovable(row);
      }),
    [isRowBulkApprovable, rowById]
  );

  const filterSelectedConfirmableIds = useCallback(
    (ids: string[]) =>
      ids.filter((id) => {
        const row = rowById.get(id);
        return row != null && isRowBulkConfirmable(row);
      }),
    [isRowBulkConfirmable, rowById]
  );

  const handleBulkRowToggle = useCallback((salesOrderId: string, checked: boolean) => {
    setBulkSelectAllMatching(false);
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(salesOrderId);
      else next.delete(salesOrderId);
      return next;
    });
  }, []);

  const handleBulkPageToggle = useCallback(
    (checked: boolean) => {
      setBulkSelectAllMatching(false);
      setBulkSelectedIds((current) => {
        const next = new Set(current);
        for (const id of selectableVisibleIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [selectableVisibleIds]
  );

  const handleBulkApprove = useCallback(() => {
    const ids = filterSelectedApprovableIds(resolveSelectedIds());
    if (ids.length === 0) {
      toast.error("Select at least one sales order pending your approval.");
      return;
    }

    startBulkTransition(async () => {
      const result = await bulkApproveSalesOrders({ sales_order_ids: ids });
      if (result.success !== true) {
        toast.error(result.error ?? "Unable to approve the selected sales orders.");
        return;
      }

      const approvedCount = result.approvedIds.length;
      const failedCount = result.failures.length;
      if (failedCount > 0) {
        toast.success(
          `${approvedCount} sales ${approvedCount === 1 ? "order" : "orders"} approved; ${failedCount} could not be approved.`
        );
      } else {
        toast.success(
          `${approvedCount} sales ${approvedCount === 1 ? "order" : "orders"} approved`
        );
      }
      clearBulkSelection();
      refreshList();
      notifyApprovalAlertChanged();
    });
  }, [clearBulkSelection, filterSelectedApprovableIds, refreshList, resolveSelectedIds]);

  const handleBulkConfirm = useCallback(() => {
    const ids = filterSelectedConfirmableIds(resolveSelectedIds());
    if (ids.length === 0) {
      toast.error("Select at least one sales order that can be confirmed.");
      return;
    }

    startBulkTransition(async () => {
      const result = await bulkConfirmSalesOrders({ sales_order_ids: ids });
      if (result.success !== true) {
        toast.error(result.error ?? "Unable to confirm the selected sales orders.");
        return;
      }

      const confirmedCount = result.confirmedIds.length;
      const failedCount = result.failures.length;
      if (failedCount > 0) {
        toast.success(
          `${confirmedCount} sales ${confirmedCount === 1 ? "order" : "orders"} confirmed; ${failedCount} could not be confirmed.`
        );
      } else {
        toast.success(
          `${confirmedCount} sales ${confirmedCount === 1 ? "order" : "orders"} confirmed`
        );
      }
      clearBulkSelection();
      refreshList();
    });
  }, [clearBulkSelection, filterSelectedConfirmableIds, refreshList, resolveSelectedIds]);

  const handleSortChange = useCallback(
    (field: SalesOrderListSortField, direction: SalesOrderListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const handlePrefsChange = useCallback(
    (nextPrefs: SalesOrderListPrefs) => {
      const statusChanged = nextPrefs.status !== prefs.status;
      setPrefs(nextPrefs);
      if (!statusChanged) return;

      const params = liveSearchParams(searchParams);
      if (nextPrefs.status === "all") {
        params.delete(SO_STATUS_FILTER_PARAM);
      } else {
        params.set(SO_STATUS_FILTER_PARAM, nextPrefs.status);
      }

      drawer.replaceDrawerHref(
        buildModuleHref(SALES_ORDERS_HREF, {
          recordId: drawer.recordId,
          variantId: drawer.variantId,
          action: drawer.action,
          preserveParams: params,
        })
      );
    },
    [drawer.action, drawer.recordId, drawer.replaceDrawerHref, drawer.variantId, prefs.status, searchParams]
  );

  const listPrimary = isListBootstrapping ? (
    <div
      className="flex h-full min-h-0 flex-1 flex-col p-1"
      aria-busy="true"
      aria-label="Loading sales orders"
    >
      <Skeleton className="h-full min-h-[240px] w-full shimmer" />
    </div>
  ) : !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <SoEmptyState
        onCreate={editAccessGranted ? drawer.openCreate : undefined}
        hasLocations={locations.length > 0}
        hasCustomers={customers.length > 0}
      />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No sales orders match the current filters.
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      <SoListTable
        rows={sortedRows}
        columnPrefs={activeColumnPrefs}
        sortField={prefs.sortField}
        sortDirection={prefs.sortDirection}
        frozenColumnCount={prefs.frozenColumnCount}
        onSortChange={handleSortChange}
        onColumnWidthChange={(columnId, width) =>
          setPrefs((current) => setSalesOrderColumnWidth(current, deviceClass, columnId, width))
        }
        selectedId={selectedId}
        onSelect={handleSelect}
        bulkSelectionEnabled={showBulkSelectionColumn}
        bulkSelectedIds={bulkSelectedIds}
        pageAllSelected={pageAllSelected}
        pageSomeSelected={pageSomeSelected}
        isRowBulkSelectable={isRowBulkSelectable}
        onBulkRowToggle={handleBulkRowToggle}
        onBulkPageToggle={handleBulkPageToggle}
      />
      <ListLoadMoreFooter
        visibleCount={salesOrders.length}
        totalCount={totalCount}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        noun="sales orders"
      />
    </div>
  );

  const bulkToolbar =
    hasAnyData && (canBulkApprove || canBulkConfirm) && bulkSelectionCount > 0 ? (
      <SalesBulkActionToolbar
        entitySingular="sales order"
        entityPlural="sales orders"
        selectionMenuLabel="Select sales orders for bulk actions"
        ariaLabel="Bulk sales order actions"
        selectedCount={bulkSelectedIds.size}
        totalMatchingCount={selectableMatchingIds.length}
        selectAllMatching={bulkSelectAllMatching}
        pageAllSelected={pageAllSelected}
        visibleCount={selectableVisibleIds.length}
        isPending={isBulkPending}
        pendingLabel="Processing sales orders"
        onClearSelection={clearBulkSelection}
        onSelectPage={() => handleBulkPageToggle(true)}
        onSelectAllMatching={() => {
          setBulkSelectAllMatching(true);
          setBulkSelectedIds(new Set(selectableMatchingIds));
        }}
        onApprove={canBulkApprove ? handleBulkApprove : undefined}
        onConfirm={canBulkConfirm ? handleBulkConfirm : undefined}
        confirmLabel="Confirm"
        embedded
      />
    ) : null;

  const listFooter = (
    <ListLoadMoreFooter
      visibleCount={salesOrders.length}
      totalCount={totalCount}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      noun="sales orders"
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: sortedRows,
    selectedId,
    onSelect: handleSelect,
    mapRow: mapSalesOrderRowToSplitFeed,
    hasAnyData,
    emptyMessage: "No sales orders match the current filters.",
    footer: listFooter,
    loading: isListBootstrapping ? (
      <div className="spatial-master-feed-pane p-2" aria-busy="true" aria-label="Loading sales orders">
        <Skeleton className="h-24 w-full shimmer" />
        <Skeleton className="mt-2 h-16 w-full shimmer" />
      </div>
    ) : undefined,
    empty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <SoEmptyState
          onCreate={editAccessGranted ? drawer.openCreate : undefined}
          hasLocations={locations.length > 0}
          hasCustomers={customers.length > 0}
        />
      </div>
    ),
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No sales orders match the current filters.
        </div>
      </div>
    ),
    bulkEnabled: showBulkSelectionColumn,
    bulkSelectedIds,
    pageAllSelected,
    pageSomeSelected,
    onBulkRowToggle: handleBulkRowToggle,
    onBulkPageToggle: handleBulkPageToggle,
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
            title="Sales Orders"
            count={
              hasAnyData ? `${ordersView.resultCount}/${ordersView.totalCount}` : undefined
            }
            onNew={editAccessGranted ? drawer.openCreate : undefined}
            newAriaLabel="New sales order"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              hasAnyData ? (
                <SoListToolbar
                  prefs={prefs}
                  onPrefsChange={handlePrefsChange}
                  locations={locations}
                  resultCount={ordersView.resultCount}
                  totalCount={ordersView.totalCount}
                  compactCountLabel={drawer.isOpen}
                  prefsHydrated={prefsHydrated}
                  hideCount
                />
              ) : undefined
            }
          />
        }
        bulkToolbar={bulkToolbar}
      >
        <ListWorkspaceCatalogBody
          peekOpen={peekOpen}
          splitEmptyTitle="Select a sales order"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      {drawer.isOpen ? (
        <SoDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface}
          locations={locations}
          customers={customers}
          peekOrder={peekOrder}
          peekRecordId={selectedId}
          editOrderId={editOrderId}
          onClose={drawer.close}
          onAfterSave={handleAfterSave}
          onOpenEdit={handleOpenEdit}
          onEditNotAllowed={handleEditNotAllowed}
          editAccessGranted={editAccessGranted}
          allowLineItemDiscounts={allowLineItemDiscounts}
          allowTransactionDiscounts={allowTransactionDiscounts}
          defaultCurrency={defaultCurrency}
          documentLayout={documentLayout}
          taxCodeOptions={taxCodeOptions}
          tenantCountry={tenantCountry}
          gstRegistered={gstRegistered}
          preferredShippingLocationId={preferredShippingLocationId}
          copyFromId={copyFromId}
          createPrefillQuoteId={createPrefillQuoteId}
          documentConversionMode={documentConversionMode}
          onDuplicate={editAccessGranted ? handleDuplicate : undefined}
          approvalSettings={approvalSettings}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      ) : null}
      </>
    </ListWorkspaceModuleFrame>
  );
}
