"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchMoreGoodsReceipts } from "@/app/procurement/goods-receipts/actions";
import { GrnEmptyState } from "@/components/procurement/goods-receipts/grn-empty-state";
import { GrnListTable } from "@/components/procurement/goods-receipts/grn-list-table";
import { GrnListToolbar } from "@/components/procurement/goods-receipts/grn-list-toolbar";
import { ListLoadMoreFooter } from "@/components/layout/list-load-more-footer";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useDocumentListPagination } from "@/lib/documents/use-document-list-pagination";
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
import type { ImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import type { LandedCostAllocationMethod, ProcurementSettings } from "@/lib/procurement/settings";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const GRN_PAGE_DESCRIPTION =
  "Post goods receipts to increase on-hand stock — against purchase orders or as standalone receipts.";

const GrnDrawerForm = lazyClientExport(
  () => import("@/components/procurement/goods-receipts/grn-drawer-form"),
  "GrnDrawerForm"
);

type Props = {
  initialGoodsReceipts: GoodsReceiptRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  initialReceivableOrders: ReceivablePurchaseOrderOption[];
  locations: ProcurementLocationOption[];
  defaultLandedCostAllocationMethod?: LandedCostAllocationMethod;
  procurementSettings: Pick<
    ProcurementSettings,
    "is_qc_required_before_stocking" | "allow_qc_line_override"
  >;
  importLogisticsSettings: ImportLogisticsSettings;
};

export function GrnManagementTerminal({
  initialGoodsReceipts,
  listTotalCount = initialGoodsReceipts.length,
  listHasMore = false,
  initialReceivableOrders,
  locations,
  defaultLandedCostAllocationMethod = "BY_VALUE",
  procurementSettings,
  importLogisticsSettings,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(PROCUREMENT_GRN_HREF, {
    clearParamsOnClose: [GRN_DRAWER_PO_PARAM],
  });
  const {
    rows: goodsReceipts,
    totalCount,
    hasMore,
    isLoadingMore,
    refreshList,
    loadMore,
  } = useDocumentListPagination(
    initialGoodsReceipts,
    listTotalCount,
    listHasMore,
    fetchMoreGoodsReceipts,
    "goods receipts"
  );
  const [receivableOrders, setReceivableOrders] = useState(initialReceivableOrders);
  const [prefs, setPrefs] = useState<GoodsReceiptListPrefs>(getDefaultGoodsReceiptListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadGoodsReceiptListPrefs();
    if (
      loaded.locationId &&
      !locations.some((location) => location.id === loaded.locationId)
    ) {
      loaded.locationId = null;
    }
    setPrefs(loaded);
    setPrefsHydrated(true);
  }, [locations]);

  useEffect(() => {
    setReceivableOrders(initialReceivableOrders);
  }, [initialReceivableOrders]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveGoodsReceiptListPrefs(prefs);
  }, [prefs, prefsHydrated]);

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
    <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
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
      <ListLoadMoreFooter
        visibleCount={sortedRows.length}
        totalCount={totalCount}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        noun="goods receipts"
      />
    </div>
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

      {drawer.isOpen ? (
        <GrnDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface}
          locations={locations}
          receivableOrders={receivableOrders}
          peekReceipt={peekReceipt}
          prefillPurchaseOrderId={createPrefillPoId}
          defaultLandedCostAllocationMethod={defaultLandedCostAllocationMethod}
          procurementSettings={procurementSettings}
          importLogisticsSettings={importLogisticsSettings}
          onClose={drawer.close}
          onAfterSave={handleAfterSave}
          onReceiptUpdated={refreshList}
        />
      ) : null}
    </>
  );
}
