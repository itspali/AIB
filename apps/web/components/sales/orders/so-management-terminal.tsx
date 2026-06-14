"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { bulkApproveSalesOrders, loadSalesOrders } from "@/app/sales/orders/actions";
import { SoBulkActionToolbar } from "@/components/sales/orders/so-bulk-action-toolbar";
import { SoDrawerForm } from "@/components/sales/orders/so-drawer-form";
import { SoEmptyState } from "@/components/sales/orders/so-empty-state";
import { SoListTable } from "@/components/sales/orders/so-list-table";
import { SoListToolbar } from "@/components/sales/orders/so-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import {
  getDefaultSalesOrderListPrefs,
  loadSalesOrderListPrefs,
  saveSalesOrderListPrefs,
  setSalesOrderColumnWidth,
  type SalesOrderListPrefs,
} from "@/lib/sales/orders/list-prefs";
import {
  sortSalesOrderListRows,
  type SalesOrderListSortDirection,
  type SalesOrderListSortField,
} from "@/lib/sales/orders/list-sort";
import {
  SALES_ORDERS_HREF,
  SO_COPY_FROM_PARAM,
  SO_STATUS_FILTER_PARAM,
} from "@/lib/sales/navigation";
import type { SalesOrderStatus } from "@/lib/sales/orders/types";
import { canEditSalesOrderDocument } from "@/lib/sales/access";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import { useFilteredSalesOrders } from "@/lib/sales/orders/use-filtered-sales-orders";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { buildModuleHref } from "@/lib/layout/module-drawer-url";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import {
  canUserApproveSalesOrders,
  isSalesOrderApprovableByUser,
} from "@/lib/sales/approval-settings";

const SO_PAGE_DESCRIPTION =
  "Capture sales orders, route them through approval when required, and confirm for fulfilment.";

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
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  editAccessGranted: boolean;
  allowLineItemDiscounts: boolean;
  defaultCurrency: string;
  preferredShippingLocationId?: string | null;
  approvalSettings: SalesApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
};

export function SoManagementTerminal({
  initialSalesOrders,
  locations,
  customers,
  editAccessGranted,
  allowLineItemDiscounts,
  defaultCurrency,
  preferredShippingLocationId = null,
  approvalSettings,
  currentUserId,
  isOwner,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(SALES_ORDERS_HREF, {
    clearParamsOnClose: [SO_COPY_FROM_PARAM, SO_STATUS_FILTER_PARAM],
  });
  const copyFromId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(SO_COPY_FROM_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);
  const [salesOrders, setSalesOrders] = useState(initialSalesOrders);
  const [prefs, setPrefs] = useState<SalesOrderListPrefs>(getDefaultSalesOrderListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  const canBulkApprove = canUserApproveSalesOrders(currentUserId, approvalSettings, {
    isOwner,
  });

  const isRowBulkApprovable = useCallback(
    (row: SalesOrderRow) => {
      if (isOwner) return row.commercial_status === "PENDING_APPROVAL";
      return isSalesOrderApprovableByUser(row, currentUserId, approvalSettings, { isOwner });
    },
    [approvalSettings, currentUserId, isOwner]
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

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      try {
        const nextOrders = await loadSalesOrders();
        setSalesOrders(nextOrders);
      } catch (error) {
        console.error("[SoManagementTerminal] refresh failed", error);
        toast.error(error instanceof Error ? error.message : "Unable to refresh sales orders.");
      }
    });
  }, []);

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
      if (
        order &&
        !canEditSalesOrderDocument(order.commercial_status, {
          allowEditConfirmed: false,
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

  const sortedRows = useMemo(
    () => sortSalesOrderListRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const approvableMatchingIds = useMemo(
    () => filteredRows.filter(isRowBulkApprovable).map((row) => row.id),
    [filteredRows, isRowBulkApprovable]
  );

  const approvableVisibleIds = useMemo(
    () => sortedRows.filter(isRowBulkApprovable).map((row) => row.id),
    [isRowBulkApprovable, sortedRows]
  );

  const pageAllSelected =
    approvableVisibleIds.length > 0 &&
    approvableVisibleIds.every((id) => bulkSelectedIds.has(id));
  const pageSomeSelected =
    approvableVisibleIds.some((id) => bulkSelectedIds.has(id)) && !pageAllSelected;

  const bulkSelectionCount = bulkSelectAllMatching
    ? approvableMatchingIds.length
    : bulkSelectedIds.size;

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const resolveSelectedIds = useCallback(
    () => resolveBulkSalesOrderIds(bulkSelectAllMatching, bulkSelectedIds, approvableMatchingIds),
    [approvableMatchingIds, bulkSelectAllMatching, bulkSelectedIds]
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
        for (const id of approvableVisibleIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [approvableVisibleIds]
  );

  const handleBulkApprove = useCallback(() => {
    const ids = resolveSelectedIds();
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
  }, [clearBulkSelection, refreshList, resolveSelectedIds]);

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

  const listPrimary = !hasAnyData ? (
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
    <SoListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      onColumnWidthChange={(columnId, width) =>
        setPrefs((current) => setSalesOrderColumnWidth(current, columnId, width))
      }
      selectedId={selectedId}
      onSelect={handleSelect}
      bulkSelectionEnabled={canBulkApprove}
      bulkSelectedIds={bulkSelectedIds}
      pageAllSelected={pageAllSelected}
      pageSomeSelected={pageSomeSelected}
      isRowBulkSelectable={isRowBulkApprovable}
      onBulkRowToggle={handleBulkRowToggle}
      onBulkPageToggle={handleBulkPageToggle}
    />
  );

  const bulkToolbar =
    hasAnyData && canBulkApprove && bulkSelectionCount > 0 ? (
      <SoBulkActionToolbar
        selectedCount={bulkSelectedIds.size}
        totalMatchingCount={approvableMatchingIds.length}
        selectAllMatching={bulkSelectAllMatching}
        pageAllSelected={pageAllSelected}
        visibleCount={approvableVisibleIds.length}
        isPending={isBulkPending}
        onClearSelection={clearBulkSelection}
        onSelectPage={() => handleBulkPageToggle(true)}
        onSelectAllMatching={() => {
          setBulkSelectAllMatching(true);
          setBulkSelectedIds(new Set(approvableMatchingIds));
        }}
        onApprove={handleBulkApprove}
        embedded
      />
    ) : null;

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Sales Orders"
            description={SO_PAGE_DESCRIPTION}
            createLabel="New sales order"
            onCreate={editAccessGranted ? drawer.openCreate : undefined}
            aboutAriaLabel="About Sales Orders"
          />
        }
        toolbar={
          hasAnyData ? (
            <SoListToolbar
              prefs={prefs}
              onPrefsChange={handlePrefsChange}
              locations={locations}
              resultCount={ordersView.resultCount}
              totalCount={ordersView.totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
        bulkToolbar={bulkToolbar}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          {listPrimary}
        </div>
      </ListModuleShell>

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
        defaultCurrency={defaultCurrency}
        preferredShippingLocationId={preferredShippingLocationId}
        copyFromId={copyFromId}
        onDuplicate={editAccessGranted ? handleDuplicate : undefined}
        approvalSettings={approvalSettings}
        currentUserId={currentUserId}
        isOwner={isOwner}
      />
    </>
  );
}
