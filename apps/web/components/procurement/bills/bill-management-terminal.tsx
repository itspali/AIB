"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { fetchMorePurchaseBills } from "@/app/procurement/bills/actions";
import { ListLoadMoreFooter } from "@/components/layout/list-load-more-footer";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { BillEmptyState } from "@/components/procurement/bills/bill-empty-state";
import { BillListTable } from "@/components/procurement/bills/bill-list-table";
import { BillListToolbar } from "@/components/procurement/bills/bill-list-toolbar";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import {
  getDefaultPurchaseBillListPrefs,
  loadPurchaseBillListPrefs,
  savePurchaseBillListPrefs,
  setPurchaseBillColumnWidth,
  type PurchaseBillListPrefs,
} from "@/lib/procurement/bills/list-prefs";
import { useActiveTableColumnPrefs } from "@/lib/list-columns/use-active-table-column-prefs";
import {
  sortPurchaseBillListRows,
  type PurchaseBillListSortDirection,
  type PurchaseBillListSortField,
} from "@/lib/procurement/bills/list-sort";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import { useFilteredBills } from "@/lib/procurement/bills/use-filtered-bills";
import type { BillMatchStatus } from "@/lib/procurement/bills/three-way-match";
import {
  BILL_DRAWER_PO_PARAM,
  BILL_MATCH_STATUS_FILTER_PARAM,
  BILL_PAID_FILTER_PARAM,
  PROCUREMENT_BILLS_HREF,
} from "@/lib/procurement/navigation";
import type { BillablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { useDocumentListPagination } from "@/lib/documents/use-document-list-pagination";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapPurchaseBillRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";


const BillDrawerForm = lazyClientExport(
  () => import("@/components/procurement/bills/bill-drawer-form"),
  "BillDrawerForm"
);

type Props = {
  initialBills: PurchaseBillRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  billableOrders: BillablePurchaseOrderOption[];
  matchingTolerancePct: number;
};

function canEditBillDocument(bill: PurchaseBillRow): boolean {
  return !bill.is_paid;
}

export function BillManagementTerminal({
  initialBills,
  listTotalCount = initialBills.length,
  listHasMore = false,
  suppliers,
  locations,
  billableOrders,
  matchingTolerancePct,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(PROCUREMENT_BILLS_HREF, {
    clearParamsOnClose: [BILL_DRAWER_PO_PARAM, BILL_MATCH_STATUS_FILTER_PARAM, BILL_PAID_FILTER_PARAM],
  });
  const {
    rows: bills,
    totalCount,
    hasMore,
    isLoadingMore,
    refreshList,
    loadMore,
  } = useDocumentListPagination(
    initialBills,
    listTotalCount,
    listHasMore,
    fetchMorePurchaseBills,
    "supplier bills"
  );
  const [prefs, setPrefs] = useState<PurchaseBillListPrefs>(getDefaultPurchaseBillListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const { deviceClass, slice: activeColumnPrefs } = useActiveTableColumnPrefs(prefs.columnPrefs);

  useEffect(() => {
    setPrefs(loadPurchaseBillListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    const matchParam = searchParams.get(BILL_MATCH_STATUS_FILTER_PARAM)?.trim();
    if (matchParam && matchParam !== "all") {
      setPrefs((current) =>
        current.matchStatus === matchParam
          ? current
          : { ...current, matchStatus: matchParam as BillMatchStatus | "all" }
      );
    }

    const paidParam = searchParams.get(BILL_PAID_FILTER_PARAM)?.trim();
    if (paidParam === "paid" || paidParam === "unpaid") {
      setPrefs((current) =>
        current.paidFilter === paidParam ? current : { ...current, paidFilter: paidParam }
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (!prefsHydrated) return;
    savePurchaseBillListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const billsView = useFilteredBills(bills, prefs);

  const selectedId = drawer.recordId;
  const peekBill =
    selectedId != null && drawer.surface === "peek"
      ? (bills.find((row) => row.id === selectedId) ?? null)
      : null;

  const editBillId =
    drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const createPrefillPoId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(BILL_DRAWER_PO_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);

  const handleSelect = useCallback(
    (billId: string) => {
      drawer.openPeek(billId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (billId: string) => {
      refreshList();
      drawer.afterSave(billId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (billId: string) => {
      const bill = bills.find((row) => row.id === billId);
      if (bill && !canEditBillDocument(bill)) {
        drawer.openPeek(billId);
        return;
      }
      drawer.openEdit(billId);
    },
    [bills, drawer]
  );

  const handleEditNotAllowed = useCallback(
    (billId: string) => {
      drawer.openPeek(billId);
    },
    [drawer]
  );

  const hasAnyData = bills.length > 0;
  const filteredRows = billsView.filteredRows;

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: filteredRows,
    extractSearchable: (row) => [
      row.invoice_number_vendor,
      row.system_voucher_number,
      row.supplier_name,
      row.purchase_order_number,
      row.match_status,
      row.document_status,
    ],
  });

  const sortedRows = useMemo(
    () => sortPurchaseBillListRows(feedFilteredRows, prefs.sortField, prefs.sortDirection),
    [feedFilteredRows, prefs.sortDirection, prefs.sortField]
  );

  const handleSortChange = useCallback(
    (field: PurchaseBillListSortField, direction: PurchaseBillListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <BillEmptyState
        onCreate={drawer.openCreate}
        hasBillableOrders={billableOrders.length > 0}
        hasSuppliers={suppliers.length > 0}
      />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No supplier bills match the current filters.
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      <BillListTable
        rows={sortedRows}
        columnPrefs={activeColumnPrefs}
        sortField={prefs.sortField}
        sortDirection={prefs.sortDirection}
        frozenColumnCount={prefs.frozenColumnCount}
        onSortChange={handleSortChange}
        onColumnWidthChange={(columnId, width) =>
          setPrefs((current) => setPurchaseBillColumnWidth(current, deviceClass, columnId, width))
        }
        selectedId={selectedId}
        onSelect={handleSelect}
      />
      <ListLoadMoreFooter
        visibleCount={bills.length}
        totalCount={totalCount}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        noun="supplier bills"
      />
    </div>
  );

  const listFooter = (
    <ListLoadMoreFooter
      visibleCount={bills.length}
      totalCount={totalCount}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      noun="supplier bills"
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: sortedRows,
    selectedId,
    onSelect: handleSelect,
    mapRow: mapPurchaseBillRowToSplitFeed,
    hasAnyData,
    emptyMessage: "No supplier bills match the current filters.",
    footer: listFooter,
    empty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <BillEmptyState
          onCreate={drawer.openCreate}
          hasBillableOrders={billableOrders.length > 0}
          hasSuppliers={suppliers.length > 0}
        />
      </div>
    ),
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No supplier bills match the current filters.
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
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Supplier bills"
            count={hasAnyData ? `${billsView.resultCount}/${billsView.totalCount}` : undefined}
            onNew={drawer.openCreate}
            newAriaLabel="New bill"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              hasAnyData ? (
                <BillListToolbar
                  prefs={prefs}
                  onPrefsChange={setPrefs}
                  suppliers={suppliers}
                  resultCount={billsView.resultCount}
                  totalCount={billsView.totalCount}
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
          splitEmptyTitle="Select a supplier bill"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      {drawer.isOpen ? (
        <BillDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface}
          suppliers={suppliers}
          locations={locations}
          billableOrders={billableOrders}
          matchingTolerancePct={matchingTolerancePct}
          peekBill={peekBill}
          peekRecordId={selectedId}
          editBillId={editBillId}
          createPrefillPoId={createPrefillPoId}
          onClose={drawer.close}
          onAfterSave={handleAfterSave}
          onOpenEdit={handleOpenEdit}
          onEditNotAllowed={handleEditNotAllowed}
        />
      ) : null}
      </>
    </ListWorkspaceModuleFrame>
  );
}
