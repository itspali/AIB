"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { loadPurchaseOrders } from "@/app/procurement/purchase-orders/actions";
import { PoDrawerForm } from "@/components/procurement/purchase-orders/po-drawer-form";
import { PoEmptyState } from "@/components/procurement/purchase-orders/po-empty-state";
import { PoListTable } from "@/components/procurement/purchase-orders/po-list-table";
import { PoListToolbar } from "@/components/procurement/purchase-orders/po-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultPurchaseOrderListPrefs,
  loadPurchaseOrderListPrefs,
  savePurchaseOrderListPrefs,
  setPurchaseOrderColumnWidth,
  type PurchaseOrderListPrefs,
} from "@/lib/procurement/purchase-orders/list-prefs";
import {
  sortPurchaseOrderListRows,
  type PurchaseOrderListSortDirection,
  type PurchaseOrderListSortField,
} from "@/lib/procurement/purchase-orders/list-sort";
import { PROCUREMENT_PO_HREF } from "@/lib/procurement/navigation";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { useFilteredPurchaseOrders } from "@/lib/procurement/purchase-orders/use-filtered-purchase-orders";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const PO_PAGE_DESCRIPTION =
  "Raise draft purchase orders, issue them to suppliers, and receive stock on goods receipts.";

type Props = {
  initialPurchaseOrders: PurchaseOrderRow[];
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
};

export function PoManagementTerminal({
  initialPurchaseOrders,
  locations,
  suppliers,
}: Props) {
  const drawer = useModuleDrawerUrl(PROCUREMENT_PO_HREF);
  const [purchaseOrders, setPurchaseOrders] = useState(initialPurchaseOrders);
  const [prefs, setPrefs] = useState<PurchaseOrderListPrefs>(getDefaultPurchaseOrderListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadPurchaseOrderListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    savePurchaseOrderListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      const nextOrders = await loadPurchaseOrders();
      setPurchaseOrders(nextOrders);
    });
  }, []);

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
      drawer.openEdit(purchaseOrderId);
    },
    [drawer]
  );

  const hasAnyData = purchaseOrders.length > 0;
  const filteredRows = ordersView.filteredRows;

  const sortedRows = useMemo(
    () => sortPurchaseOrderListRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const handleSortChange = useCallback(
    (field: PurchaseOrderListSortField, direction: PurchaseOrderListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <PoEmptyState
        onCreate={drawer.openCreate}
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
    <PoListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      onColumnWidthChange={(columnId, width) =>
        setPrefs((current) => setPurchaseOrderColumnWidth(current, columnId, width))
      }
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  );

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Purchase Orders"
            description={PO_PAGE_DESCRIPTION}
            createLabel="New purchase order"
            onCreate={drawer.openCreate}
            aboutAriaLabel="About Purchase Orders"
          />
        }
        toolbar={
          hasAnyData ? (
            <PoListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              locations={locations}
              resultCount={ordersView.resultCount}
              totalCount={ordersView.totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          {listPrimary}
        </div>
      </ListModuleShell>

      <PoDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        locations={locations}
        suppliers={suppliers}
        peekOrder={peekOrder}
        editOrderId={editOrderId}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
        onOpenEdit={handleOpenEdit}
      />
    </>
  );
}
