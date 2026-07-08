"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { bulkApprovePurchaseOrders, fetchMorePurchaseOrders } from "@/app/procurement/purchase-orders/actions";
import { ListLoadMoreFooter } from "@/components/layout/list-load-more-footer";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { PoBulkActionToolbar } from "@/components/procurement/purchase-orders/po-bulk-action-toolbar";
import { PoEmptyState } from "@/components/procurement/purchase-orders/po-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PoListTable } from "@/components/procurement/purchase-orders/po-list-table";
import { PoListToolbar } from "@/components/procurement/purchase-orders/po-list-toolbar";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
import {
  getDefaultPurchaseOrderListPrefs,
  getPurchaseOrderColumnPrefsSlice,
  loadPurchaseOrderListPrefs,
  savePurchaseOrderListPrefs,
  setPurchaseOrderColumnWidth,
  type PurchaseOrderListPrefs,
} from "@/lib/procurement/purchase-orders/list-prefs";
import { useActiveTableColumnPrefs } from "@/lib/list-columns/use-active-table-column-prefs";
import {
  sortPurchaseOrderListRows,
  type PurchaseOrderListSortDirection,
  type PurchaseOrderListSortField,
} from "@/lib/procurement/purchase-orders/list-sort";
import { PROCUREMENT_PO_HREF, PO_COPY_FROM_PARAM, PO_STATUS_FILTER_PARAM } from "@/lib/procurement/navigation";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";
import { canEditPurchaseOrderDocument } from "@/lib/procurement/access";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { useFilteredPurchaseOrders } from "@/lib/procurement/purchase-orders/use-filtered-purchase-orders";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { buildModuleHref } from "@/lib/layout/module-drawer-url";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapPurchaseOrderRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";
import { useFinanceSetupCreateGate } from "@/lib/onboarding/use-finance-setup-create-gate";
import { useDocumentListPagination } from "@/lib/documents/use-document-list-pagination";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { PoAutoRoundOffPolicy } from "@/lib/procurement/purchase-orders/po-auto-round-off";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import {
  canUserApprovePurchaseOrders,
  isPurchaseOrderApprovableByUser,
} from "@/lib/procurement/approval-settings";
import type { PoFulfillmentStage } from "@/lib/procurement/import-logistics-settings-shared";


const PoDrawerForm = lazyClientExport(
  () => import("@/components/procurement/purchase-orders/po-drawer-form"),
  "PoDrawerForm"
);

function liveSearchParams(fallback: ReturnType<typeof useSearchParams>): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams(fallback.toString());
  return new URLSearchParams(window.location.search);
}

function resolveBulkPurchaseOrderIds(
  bulkSelectAllMatching: boolean,
  bulkSelectedIds: Set<string>,
  matchingIds: string[]
): string[] {
  if (bulkSelectAllMatching) return matchingIds;
  return [...bulkSelectedIds];
}

type Props = {
  initialPurchaseOrders: PurchaseOrderRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  editAccessGranted: boolean;
  allowEditIssuedPurchaseOrders: boolean;
  allowLineItemDiscounts: boolean;
  allowTransactionDiscounts?: boolean;
  enableMrpTradeTerms?: boolean;
  promoDefaultCategory?: string;
  autoRoundOffPolicy?: PoAutoRoundOffPolicy;
  defaultPricesTaxInclusive: boolean;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  preferredDestinationLocationId?: string | null;
  organizationBillTo: OrganizationBillToSnapshot;
  taxCodeOptions: readonly PoLineTaxCodeOption[];
  approvalSettings: ProcurementApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
  financeSetupComplete: boolean;
  tenantDefaultFulfillmentStage?: PoFulfillmentStage;
};

export function PoManagementTerminal({
  initialPurchaseOrders,
  listTotalCount = initialPurchaseOrders.length,
  listHasMore = false,
  locations,
  suppliers,
  editAccessGranted,
  allowEditIssuedPurchaseOrders,
  allowLineItemDiscounts,
  allowTransactionDiscounts = false,
  enableMrpTradeTerms = true,
  promoDefaultCategory = "FREE_GOODS",
  autoRoundOffPolicy,
  defaultPricesTaxInclusive,
  defaultCurrency,
  documentLayout,
  preferredDestinationLocationId = null,
  organizationBillTo,
  taxCodeOptions,
  approvalSettings,
  currentUserId,
  isOwner,
  financeSetupComplete,
  tenantDefaultFulfillmentStage = "COMMERCIAL",
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(PROCUREMENT_PO_HREF, {
    clearParamsOnClose: [PO_COPY_FROM_PARAM, PO_STATUS_FILTER_PARAM],
  });
  const guardedOpenCreate = useFinanceSetupCreateGate({
    financeSetupComplete,
    openCreate: drawer.openCreate,
    closeDrawer: drawer.close,
    drawerSurface: drawer.surface,
  });
  const copyFromId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(PO_COPY_FROM_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);
  const {
    rows: purchaseOrders,
    totalCount,
    hasMore,
    isLoadingMore,
    isListBootstrapping,
    refreshList,
    loadMore,
  } = useDocumentListPagination(
    initialPurchaseOrders,
    listTotalCount,
    listHasMore,
    fetchMorePurchaseOrders,
    "purchase orders"
  );
  const [prefs, setPrefs] = useState<PurchaseOrderListPrefs>(getDefaultPurchaseOrderListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const { deviceClass, slice: activeColumnPrefs } = useActiveTableColumnPrefs(prefs.columnPrefs);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  const canBulkApprove = canUserApprovePurchaseOrders(currentUserId, approvalSettings, {
    isOwner,
  });

  const isRowBulkApprovable = useCallback(
    (row: PurchaseOrderRow) => {
      if (!canBulkApprove) return false;
      if (isOwner) return row.document_status === "PENDING_APPROVAL";
      return isPurchaseOrderApprovableByUser(row, currentUserId, approvalSettings, { isOwner });
    },
    [approvalSettings, canBulkApprove, currentUserId, isOwner]
  );

  useEffect(() => {
    setPrefs(loadPurchaseOrderListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get(PO_STATUS_FILTER_PARAM)?.trim();
    if (!statusParam || statusParam === "all") return;
    setPrefs((current) =>
      current.status === statusParam
        ? current
        : { ...current, status: statusParam as PurchaseOrderStatus | "all" }
    );
  }, [searchParams]);

  useEffect(() => {
    if (!prefsHydrated) return;
    savePurchaseOrderListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const ordersView = useFilteredPurchaseOrders(purchaseOrders, prefs);

  const selectedId = drawer.recordId;
  const peekOrder =
    selectedId != null && drawer.surface === "peek"
      ? (purchaseOrders.find((row) => row.id === selectedId) ?? null)
      : null;

  const editOrderId =
    drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const handleSelect = useCallback(
    (purchaseOrderId: string) => {
      drawer.openPeek(purchaseOrderId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (purchaseOrderId: string) => {
      refreshList();
      drawer.afterSave(purchaseOrderId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (purchaseOrderId: string) => {
      const order = purchaseOrders.find((row) => row.id === purchaseOrderId);
      if (
        order &&
        !canEditPurchaseOrderDocument(order.document_status, {
          allowEditIssued: allowEditIssuedPurchaseOrders,
          hasEditPermission: editAccessGranted,
        })
      ) {
        drawer.openPeek(purchaseOrderId);
        return;
      }
      drawer.openEdit(purchaseOrderId);
    },
    [allowEditIssuedPurchaseOrders, drawer, editAccessGranted, purchaseOrders]
  );

  const handleEditNotAllowed = useCallback(
    (purchaseOrderId: string) => {
      drawer.openPeek(purchaseOrderId);
    },
    [drawer]
  );

  const handleDuplicate = useCallback(
    (purchaseOrderId: string) => {
      guardedOpenCreate({
        extraParams: { [PO_COPY_FROM_PARAM]: purchaseOrderId },
      });
    },
    [guardedOpenCreate]
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

  const hasAnyData = purchaseOrders.length > 0;
  const filteredRows = ordersView.filteredRows;

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: filteredRows,
    extractSearchable: (row) => [
      row.voucher_number,
      row.supplier_name,
      row.destination_location_name,
      row.destination_location_code,
      row.document_status,
    ],
  });

  const sortedRows = useMemo(
    () => sortPurchaseOrderListRows(feedFilteredRows, prefs.sortField, prefs.sortDirection),
    [feedFilteredRows, prefs.sortDirection, prefs.sortField]
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

  const showBulkSelectionColumn =
    canBulkApprove && approvableMatchingIds.length > 0;

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const resolveSelectedIds = useCallback(
    () => resolveBulkPurchaseOrderIds(bulkSelectAllMatching, bulkSelectedIds, approvableMatchingIds),
    [approvableMatchingIds, bulkSelectAllMatching, bulkSelectedIds]
  );

  const handleBulkRowToggle = useCallback((purchaseOrderId: string, checked: boolean) => {
    setBulkSelectAllMatching(false);
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(purchaseOrderId);
      else next.delete(purchaseOrderId);
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
      toast.error("Select at least one purchase order pending your approval.");
      return;
    }

    startBulkTransition(async () => {
      const result = await bulkApprovePurchaseOrders({ purchase_order_ids: ids });
      if (result.success !== true) {
        toast.error(result.error ?? "Unable to approve the selected purchase orders.");
        return;
      }

      const approvedCount = result.approvedIds.length;
      const failedCount = result.failures.length;
      const issuedLabel = approvalSettings.po_auto_issue_after_approval !== false;
      if (failedCount > 0) {
        toast.success(
          `${approvedCount} purchase ${approvedCount === 1 ? "order" : "orders"} approved; ${failedCount} could not be approved.`
        );
      } else {
        toast.success(
          issuedLabel
            ? `${approvedCount} purchase ${approvedCount === 1 ? "order" : "orders"} approved and issued`
            : `${approvedCount} purchase ${approvedCount === 1 ? "order" : "orders"} approved — ready to issue`
        );
      }
      clearBulkSelection();
      refreshList();
      notifyApprovalAlertChanged();
    });
  }, [approvalSettings, clearBulkSelection, refreshList, resolveSelectedIds]);

  const handleSortChange = useCallback(
    (field: PurchaseOrderListSortField, direction: PurchaseOrderListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const handlePrefsChange = useCallback(
    (nextPrefs: PurchaseOrderListPrefs) => {
      const statusChanged = nextPrefs.status !== prefs.status;
      setPrefs(nextPrefs);
      if (!statusChanged) return;

      const params = liveSearchParams(searchParams);
      if (nextPrefs.status === "all") {
        params.delete(PO_STATUS_FILTER_PARAM);
      } else {
        params.set(PO_STATUS_FILTER_PARAM, nextPrefs.status);
      }

      drawer.replaceDrawerHref(
        buildModuleHref(PROCUREMENT_PO_HREF, {
          recordId: drawer.recordId,
          variantId: drawer.variantId,
          action: drawer.action,
          preserveParams: params,
        })
      );
    },
    [
      drawer.action,
      drawer.recordId,
      drawer.replaceDrawerHref,
      drawer.variantId,
      prefs.status,
      searchParams,
    ]
  );

  const listPrimary = isListBootstrapping ? (
    <div
      className="flex h-full min-h-0 flex-1 flex-col p-1"
      aria-busy="true"
      aria-label="Loading purchase orders"
    >
      <Skeleton className="h-full min-h-[240px] w-full shimmer" />
    </div>
  ) : !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <PoEmptyState
        onCreate={editAccessGranted ? guardedOpenCreate : undefined}
        hasLocations={locations.length > 0}
        hasSuppliers={suppliers.length > 0}
      />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No purchase orders match the current filters.
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      <PoListTable
        rows={sortedRows}
        columnPrefs={activeColumnPrefs}
        sortField={prefs.sortField}
        sortDirection={prefs.sortDirection}
        frozenColumnCount={prefs.frozenColumnCount}
        onSortChange={handleSortChange}
        onColumnWidthChange={(columnId, width) =>
          setPrefs((current) => setPurchaseOrderColumnWidth(current, deviceClass, columnId, width))
        }
        selectedId={selectedId}
        onSelect={handleSelect}
        bulkSelectionEnabled={showBulkSelectionColumn}
        bulkSelectedIds={bulkSelectedIds}
        pageAllSelected={pageAllSelected}
        pageSomeSelected={pageSomeSelected}
        isRowBulkSelectable={isRowBulkApprovable}
        onBulkRowToggle={handleBulkRowToggle}
        onBulkPageToggle={handleBulkPageToggle}
      />
      <ListLoadMoreFooter
        visibleCount={purchaseOrders.length}
        totalCount={totalCount}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        noun="purchase orders"
      />
    </div>
  );

  const listFooter = (
    <ListLoadMoreFooter
      visibleCount={purchaseOrders.length}
      totalCount={totalCount}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      noun="purchase orders"
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: sortedRows,
    selectedId,
    onSelect: handleSelect,
    mapRow: mapPurchaseOrderRowToSplitFeed,
    hasAnyData,
    emptyMessage: "No purchase orders match the current filters.",
    footer: listFooter,
    loading: isListBootstrapping ? (
      <div className="spatial-master-feed-pane p-2" aria-busy="true" aria-label="Loading purchase orders">
        <Skeleton className="h-24 w-full shimmer" />
        <Skeleton className="mt-2 h-16 w-full shimmer" />
        <Skeleton className="mt-2 h-16 w-full shimmer" />
      </div>
    ) : undefined,
    empty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <PoEmptyState
          onCreate={editAccessGranted ? guardedOpenCreate : undefined}
          hasLocations={locations.length > 0}
          hasSuppliers={suppliers.length > 0}
        />
      </div>
    ),
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No purchase orders match the current filters.
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

  const bulkToolbar =
    hasAnyData && canBulkApprove && bulkSelectionCount > 0 ? (
      <PoBulkActionToolbar
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

  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <>
      <ListModuleShell
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Purchase Orders"
            count={
              hasAnyData ? `${sortedRows.length}/${ordersView.totalCount}` : undefined
            }
            onNew={editAccessGranted ? guardedOpenCreate : undefined}
            newAriaLabel="New purchase order"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              hasAnyData ? (
                <PoListToolbar
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
          splitEmptyTitle="Select a purchase order"
          splitEmptyMessage="Choose a PO from the registry to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      {drawer.isOpen ? (
        <PoDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface}
          locations={locations}
          suppliers={suppliers}
          peekOrder={peekOrder}
          peekRecordId={selectedId}
          editOrderId={editOrderId}
          onClose={drawer.close}
          onAfterSave={handleAfterSave}
          onOpenEdit={handleOpenEdit}
          onEditNotAllowed={handleEditNotAllowed}
          editAccessGranted={editAccessGranted}
          allowEditIssuedPurchaseOrders={allowEditIssuedPurchaseOrders}
          allowLineItemDiscounts={allowLineItemDiscounts}
          allowTransactionDiscounts={allowTransactionDiscounts}
          enableMrpTradeTerms={enableMrpTradeTerms}
          promoDefaultCategory={promoDefaultCategory}
          autoRoundOffPolicy={autoRoundOffPolicy}
          defaultPricesTaxInclusive={defaultPricesTaxInclusive}
          defaultCurrency={defaultCurrency}
          preferredDestinationLocationId={preferredDestinationLocationId}
          documentLayout={documentLayout}
          organizationBillTo={organizationBillTo}
          copyFromId={copyFromId}
          onDuplicate={editAccessGranted ? handleDuplicate : undefined}
          taxCodeOptions={taxCodeOptions}
          approvalSettings={approvalSettings}
          currentUserId={currentUserId}
          isOwner={isOwner}
          tenantDefaultFulfillmentStage={tenantDefaultFulfillmentStage}
        />
      ) : null}
      </>
    </ListWorkspaceModuleFrame>
  );
}
