"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loadGoodsReceipts } from "@/app/procurement/goods-receipts/actions";
import { GrnDrawerForm } from "@/components/procurement/goods-receipts/grn-drawer-form";
import { GrnEmptyState } from "@/components/procurement/goods-receipts/grn-empty-state";
import { GrnListTable } from "@/components/procurement/goods-receipts/grn-list-table";
import { GrnListToolbar } from "@/components/procurement/goods-receipts/grn-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultGoodsReceiptListPrefs,
  loadGoodsReceiptListPrefs,
  saveGoodsReceiptListPrefs,
  setGoodsReceiptColumnWidth,
  type GoodsReceiptListPrefs,
} from "@/lib/procurement/goods-receipts/list-prefs";
import {
  sortGoodsReceiptListRows,
  type GoodsReceiptListSortDirection,
  type GoodsReceiptListSortField,
} from "@/lib/procurement/goods-receipts/list-sort";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import { useFilteredGoodsReceipts } from "@/lib/procurement/goods-receipts/use-filtered-goods-receipts";
import { GRN_DRAWER_PO_PARAM, PROCUREMENT_GRN_HREF } from "@/lib/procurement/navigation";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const GRN_PAGE_DESCRIPTION =
  "Post goods receipts to increase on-hand stock — against purchase orders or as standalone receipts.";

type Props = {
  initialGoodsReceipts: GoodsReceiptRow[];
  initialReceivableOrders: ReceivablePurchaseOrderOption[];
  locations: ProcurementLocationOption[];
};

export function GrnManagementTerminal({
  initialGoodsReceipts,
  initialReceivableOrders,
  locations,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(PROCUREMENT_GRN_HREF, {
    clearParamsOnClose: [GRN_DRAWER_PO_PARAM],
  });
  const [goodsReceipts, setGoodsReceipts] = useState(initialGoodsReceipts);
  const [receivableOrders, setReceivableOrders] = useState(initialReceivableOrders);
  const [prefs, setPrefs] = useState<GoodsReceiptListPrefs>(getDefaultGoodsReceiptListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadGoodsReceiptListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveGoodsReceiptListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      const nextReceipts = await loadGoodsReceipts();
      setGoodsReceipts(nextReceipts);
    });
  }, []);

  const receiptsView = useFilteredGoodsReceipts(goodsReceipts, prefs);

  const selectedId = drawer.recordId;
  const peekReceipt =
    selectedId != null && drawer.surface === "peek"
      ? (goodsReceipts.find((row) => row.id === selectedId) ?? null)
      : null;

  const createPrefillPoId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(GRN_DRAWER_PO_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);

  const handleSelect = useCallback(
    (goodsReceiptId: string) => {
      drawer.openPeek(goodsReceiptId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (goodsReceiptId: string) => {
      refreshList();
      drawer.afterSave(goodsReceiptId);
    },
    [drawer, refreshList]
  );

  const hasAnyData = goodsReceipts.length > 0;
  const filteredRows = receiptsView.filteredRows;

  const sortedRows = useMemo(
    () => sortGoodsReceiptListRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const handleSortChange = useCallback(
    (field: GoodsReceiptListSortField, direction: GoodsReceiptListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <GrnEmptyState onCreate={drawer.openCreate} hasLocations={locations.length > 0} />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No goods receipts match the current filters.
      </div>
    </div>
  ) : (
    <GrnListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      onColumnWidthChange={(columnId, width) =>
        setPrefs((current) => setGoodsReceiptColumnWidth(current, columnId, width))
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
            title="Goods Receipts"
            description={GRN_PAGE_DESCRIPTION}
            createLabel="New goods receipt"
            onCreate={drawer.openCreate}
            aboutAriaLabel="About Goods Receipts"
          />
        }
        toolbar={
          hasAnyData ? (
            <GrnListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              locations={locations}
              resultCount={receiptsView.resultCount}
              totalCount={receiptsView.totalCount}
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

      <GrnDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        locations={locations}
        receivableOrders={receivableOrders}
        peekReceipt={peekReceipt}
        prefillPurchaseOrderId={createPrefillPoId}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
      />
    </>
  );
}
