"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchMoreStockAdjustments,
  fetchMoreStockBalances,
  loadPromoInventoryBalances,
  loadPromotionalReclassificationBatches,
  loadQcInventoryBalances,
} from "@/app/inventory/stock/actions";
import { StockEmptyState } from "@/components/inventory/stock/stock-empty-state";
import { StockListToolbar } from "@/components/inventory/stock/stock-list-toolbar";
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
  getDefaultStockListPrefs,
  loadStockListPrefs,
  saveStockListPrefs,
  setStockColumnWidth,
  setStockSortPrefs,
  type StockListPrefs,
} from "@/lib/inventory/stock/list-prefs";
import { useActiveTableColumnPrefs } from "@/lib/list-columns/use-active-table-column-prefs";
import type { StockAdjustmentColumnId, StockBalanceColumnId } from "@/lib/inventory/stock/list-columns";
import {
  sortStockAdjustmentRows,
  sortStockBalanceRows,
  type StockAdjustmentSortField,
  type StockBalanceSortField,
  type StockListSortDirection,
} from "@/lib/inventory/stock/list-sort";
import { STOCK_DRAWER_LOCATION_PARAM, STOCK_HREF } from "@/lib/inventory/stock/navigation";
import type {
  StockAdjustmentRow,
  StockBalanceRow,
  StockLocationOption,
} from "@/lib/inventory/stock/types";
import {
  useFilteredStockAdjustments,
  useFilteredStockBalances,
} from "@/lib/inventory/stock/use-filtered-stock";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import type { QcInventoryBalanceRow } from "@/lib/inventory/stock/qc-balances";
import {
  attachPromoQuantitiesToBalances,
  buildPromoQtyMap,
} from "@/lib/inventory/stock/promo-pool-helpers";
import { isPromoBalanceEligibleForReclassification } from "@/lib/procurement/promo/reclassification-helpers";
import type { PromotionalBatchRow } from "@/lib/procurement/promo/reclassification-helpers";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapStockAdjustmentRowToSplitFeed,
  mapStockBalanceRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";

const StockDrawerForm = lazyClientExport(
  () => import("@/components/inventory/stock/stock-drawer-form"),
  "StockDrawerForm"
);

const StockInventoryPoolsView = lazyClientExport(
  () => import("@/components/inventory/stock/stock-inventory-pools-view"),
  "StockInventoryPoolsView"
);

const StockPromoReclassificationView = lazyClientExport(
  () => import("@/components/inventory/stock/stock-promo-reclassification-view"),
  "StockPromoReclassificationView"
);

const StockBalancesTable = lazyClientExport(
  () => import("@/components/inventory/stock/stock-balances-table"),
  "StockBalancesTable"
);

const StockAdjustmentsTable = lazyClientExport(
  () => import("@/components/inventory/stock/stock-adjustments-table"),
  "StockAdjustmentsTable"
);

type Props = {
  initialBalances: StockBalanceRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  initialAdjustments: StockAdjustmentRow[];
  adjustmentsTotalCount?: number;
  adjustmentsHasMore?: boolean;
  initialPromoBalances?: PromoInventoryBalanceRow[];
  initialQcBalances?: QcInventoryBalanceRow[];
  initialDraftBatches?: PromotionalBatchRow[];
  locations: StockLocationOption[];
};

export function StockManagementTerminal({
  initialBalances,
  listTotalCount = initialBalances.length,
  listHasMore = false,
  initialAdjustments,
  adjustmentsTotalCount = initialAdjustments.length,
  adjustmentsHasMore = false,
  initialPromoBalances = [],
  initialQcBalances = [],
  initialDraftBatches = [],
  locations,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(STOCK_HREF, {
    clearParamsOnClose: [STOCK_DRAWER_LOCATION_PARAM],
  });
  const {
    rows: balances,
    totalCount: balanceServerTotalCount,
    hasMore: balanceHasMore,
    isLoadingMore: balanceLoadingMore,
    refreshList: refreshBalances,
    loadMore: loadMoreBalances,
  } = useDocumentListPagination(
    initialBalances,
    listTotalCount,
    listHasMore,
    fetchMoreStockBalances,
    "balances"
  );
  const {
    rows: adjustments,
    totalCount: adjustmentServerTotalCount,
    hasMore: adjustmentHasMore,
    isLoadingMore: adjustmentLoadingMore,
    refreshList: refreshAdjustments,
    loadMore: loadMoreAdjustments,
  } = useDocumentListPagination(
    initialAdjustments,
    adjustmentsTotalCount,
    adjustmentsHasMore,
    fetchMoreStockAdjustments,
    "adjustments"
  );
  const [promoBalances, setPromoBalances] = useState(initialPromoBalances);
  const [qcBalances, setQcBalances] = useState(initialQcBalances);
  const [draftBatches, setDraftBatches] = useState(initialDraftBatches);
  const [promoDataLoaded, setPromoDataLoaded] = useState(initialPromoBalances.length > 0);
  const [poolDataLoaded, setPoolDataLoaded] = useState(
    initialPromoBalances.length > 0 && initialQcBalances.length > 0
  );
  const [reclassificationDataLoaded, setReclassificationDataLoaded] = useState(
    initialDraftBatches.length > 0
  );
  const [prefs, setPrefs] = useState<StockListPrefs>(getDefaultStockListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const { deviceClass, slice: activeBalanceColumnPrefs } = useActiveTableColumnPrefs(
    prefs.balanceColumnPrefs
  );
  const { slice: activeAdjustmentColumnPrefs } = useActiveTableColumnPrefs(
    prefs.adjustmentColumnPrefs
  );
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadStockListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveStockListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  useEffect(() => {
    if (promoDataLoaded) return;
    startRefreshTransition(async () => {
      const nextPromoBalances = await loadPromoInventoryBalances();
      setPromoBalances(nextPromoBalances);
      setPromoDataLoaded(true);
    });
  }, [promoDataLoaded]);

  const refreshLists = useCallback(() => {
    refreshBalances();
    refreshAdjustments();
  }, [refreshAdjustments, refreshBalances]);

  const refreshPromoData = useCallback(() => {
    refreshBalances();
    refreshAdjustments();
    startRefreshTransition(async () => {
      const [nextPromoBalances, nextQcBalances, nextDraftBatches] = await Promise.all([
        loadPromoInventoryBalances(),
        loadQcInventoryBalances(),
        loadPromotionalReclassificationBatches(),
      ]);
      setPromoBalances(nextPromoBalances);
      setQcBalances(nextQcBalances);
      setDraftBatches(nextDraftBatches);
      setPromoDataLoaded(true);
      setPoolDataLoaded(true);
      setReclassificationDataLoaded(true);
    });
  }, [refreshAdjustments, refreshBalances]);

  useEffect(() => {
    if (prefs.viewMode !== "inventory_pools" || poolDataLoaded) return;
    startRefreshTransition(async () => {
      const [nextPromoBalances, nextQcBalances] = await Promise.all([
        loadPromoInventoryBalances(),
        loadQcInventoryBalances(),
      ]);
      setPromoBalances(nextPromoBalances);
      setQcBalances(nextQcBalances);
      setPromoDataLoaded(true);
      setPoolDataLoaded(true);
    });
  }, [poolDataLoaded, prefs.viewMode]);

  useEffect(() => {
    if (prefs.viewMode !== "promo_reclassification" || reclassificationDataLoaded) return;
    startRefreshTransition(async () => {
      const [nextPromoBalances, nextDraftBatches] = await Promise.all([
        loadPromoInventoryBalances(),
        loadPromotionalReclassificationBatches(),
      ]);
      setPromoBalances(nextPromoBalances);
      setDraftBatches(nextDraftBatches);
      setPromoDataLoaded(true);
      setReclassificationDataLoaded(true);
    });
  }, [prefs.viewMode, reclassificationDataLoaded]);

  const balancesView = useFilteredStockBalances(balances, prefs.locationId);
  const adjustmentsView = useFilteredStockAdjustments(adjustments, prefs.locationId);

  const { feedFilteredRows: feedFilteredBalances, feedFilterProps: balanceFeedFilterProps } =
    useListWorkspaceFeedFilter({
      rows: balancesView.filteredRows,
      extractSearchable: (row) => [
        row.variant_sku,
        row.item_name,
        row.location_name,
        row.location_code,
      ],
    });

  const { feedFilteredRows: feedFilteredAdjustments, feedFilterProps: adjustmentFeedFilterProps } =
    useListWorkspaceFeedFilter({
      rows: adjustmentsView.filteredRows,
      extractSearchable: (row) => [
        row.adjustment_number,
        row.location_name,
        row.reason,
        row.kind,
      ],
    });

  const scopedPromoBalances = useMemo(() => {
    if (!prefs.locationId) return promoBalances;
    return promoBalances.filter((row) => row.location_id === prefs.locationId);
  }, [prefs.locationId, promoBalances]);

  const scopedQcBalances = useMemo(() => {
    if (!prefs.locationId) return qcBalances;
    return qcBalances.filter((row) => row.location_id === prefs.locationId);
  }, [prefs.locationId, qcBalances]);

  const scopedBalances = balancesView.filteredRows;

  const isBalancesView = prefs.viewMode === "balances";
  const isAdjustmentsView = prefs.viewMode === "adjustments";
  const isInventoryPoolsView = prefs.viewMode === "inventory_pools";
  const isPromoReclassificationView = prefs.viewMode === "promo_reclassification";

  const feedFilterProps = isBalancesView
    ? balanceFeedFilterProps
    : isAdjustmentsView
      ? adjustmentFeedFilterProps
      : undefined;

  const inventoryPoolsCount = useMemo(
    () =>
      scopedBalances.filter((row) => Number(row.total_quantity_on_hand) > 0).length +
      scopedPromoBalances.length +
      scopedQcBalances.length,
    [scopedBalances, scopedPromoBalances, scopedQcBalances]
  );

  const promoReclassificationCount = useMemo(() => {
    const eligible = scopedPromoBalances.filter(isPromoBalanceEligibleForReclassification);
    return eligible.length + draftBatches.length;
  }, [draftBatches, scopedPromoBalances]);

  const resultCount = isBalancesView
    ? balancesView.resultCount
    : isAdjustmentsView
      ? adjustmentsView.resultCount
      : isInventoryPoolsView
        ? inventoryPoolsCount
        : promoReclassificationCount;
  const totalCount = isBalancesView
    ? balanceServerTotalCount
    : isAdjustmentsView
      ? adjustmentServerTotalCount
      : isInventoryPoolsView
        ? inventoryPoolsCount
        : promoReclassificationCount;

  const selectedDrawerId = drawer.recordId;

  const peekBalance = useMemo(() => {
    if (drawer.surface !== "peek" || !selectedDrawerId) return null;
    return balances.find((row) => row.id === selectedDrawerId) ?? null;
  }, [balances, drawer.surface, selectedDrawerId]);

  const peekAdjustment = useMemo(() => {
    if (drawer.surface !== "peek" || !selectedDrawerId || peekBalance) return null;
    return adjustments.find((row) => row.id === selectedDrawerId) ?? null;
  }, [adjustments, drawer.surface, peekBalance, selectedDrawerId]);

  const handleSelectAdjustment = useCallback(
    (adjustmentId: string) => {
      drawer.openPeek(adjustmentId);
    },
    [drawer]
  );

  const handleSelectBalance = useCallback(
    (balanceId: string) => {
      drawer.openPeek(balanceId);
    },
    [drawer]
  );

  const createPrefill = useMemo(() => {
    if (drawer.surface !== "create") return null;
    const variantId = drawer.variantId;
    const locationId = searchParams.get(STOCK_DRAWER_LOCATION_PARAM)?.trim();
    if (!variantId || !locationId) return null;

    const row = balances.find(
      (balance) => balance.variant_id === variantId && balance.location_id === locationId
    );
    if (!row) {
      return {
        location_id: locationId,
        variant_id: variantId,
        variant_sku: "",
        item_name: "",
        unit_cost: "0",
      };
    }

    return {
      location_id: row.location_id,
      variant_id: row.variant_id,
      variant_sku: row.variant_sku,
      item_name: row.item_name,
      unit_cost: row.current_average_cost || "0",
    };
  }, [balances, drawer.surface, drawer.variantId, searchParams]);

  const handleAdjustBalance = useCallback(
    (row: StockBalanceRow) => {
      drawer.openCreate({
        variantId: row.variant_id,
        extraParams: { [STOCK_DRAWER_LOCATION_PARAM]: row.location_id },
      });
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (adjustmentId: string) => {
      refreshLists();
      setPrefs((current) => ({ ...current, viewMode: "adjustments" }));
      drawer.afterSave(adjustmentId);
    },
    [drawer, refreshLists]
  );

  const hasAnyData =
    balances.length > 0 ||
    adjustments.length > 0 ||
    promoBalances.length > 0 ||
    qcBalances.length > 0 ||
    draftBatches.length > 0;

  const promoQtyMap = useMemo(() => buildPromoQtyMap(promoBalances), [promoBalances]);

  const sortedBalanceRows = useMemo(
    () =>
      sortStockBalanceRows(
        attachPromoQuantitiesToBalances(feedFilteredBalances, promoQtyMap),
        prefs.balanceSortField,
        prefs.balanceSortDirection
      ),
    [feedFilteredBalances, promoQtyMap, prefs.balanceSortField, prefs.balanceSortDirection]
  );

  const sortedAdjustmentRows = useMemo(
    () =>
      sortStockAdjustmentRows(
        feedFilteredAdjustments,
        prefs.adjustmentSortField,
        prefs.adjustmentSortDirection
      ),
    [feedFilteredAdjustments, prefs.adjustmentSortField, prefs.adjustmentSortDirection]
  );

  const handleBalanceSortChange = useCallback(
    (field: StockBalanceSortField, direction: StockListSortDirection) => {
      setPrefs((current) => setStockSortPrefs(current, field, direction));
    },
    []
  );

  const handleAdjustmentSortChange = useCallback(
    (field: StockAdjustmentSortField, direction: StockListSortDirection) => {
      setPrefs((current) => setStockSortPrefs(current, field, direction));
    },
    []
  );

  const listPrimary =
    !hasAnyData ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <StockEmptyState
          viewMode={prefs.viewMode}
          onCreate={drawer.openCreate}
          hasLocations={locations.length > 0}
        />
      </div>
    ) : isInventoryPoolsView ? (
      <StockInventoryPoolsView
        sellableRows={scopedBalances}
        promoBalances={scopedPromoBalances}
        qcBalances={scopedQcBalances}
      />
    ) : isPromoReclassificationView ? (
      <StockPromoReclassificationView
        promoBalances={scopedPromoBalances}
        draftBatches={draftBatches}
        onChanged={refreshPromoData}
      />
    ) : isBalancesView ? (
      sortedBalanceRows.length === 0 ? (
        <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
          <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No balances match the current filters.
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          <StockBalancesTable
            rows={sortedBalanceRows}
            columnPrefs={activeBalanceColumnPrefs}
            sortField={prefs.balanceSortField}
            sortDirection={prefs.balanceSortDirection}
            frozenColumnCount={prefs.frozenColumnCount}
            onSortChange={handleBalanceSortChange}
            onColumnWidthChange={(columnId: StockBalanceColumnId, width: number | null) =>
              setPrefs((current) => setStockColumnWidth(current, deviceClass, columnId, width))
            }
            selectedId={peekBalance?.id ?? null}
            onSelect={(row: StockBalanceRow) => handleSelectBalance(row.id)}
            onAdjust={handleAdjustBalance}
          />
          <ListLoadMoreFooter
            visibleCount={balances.length}
            totalCount={balanceServerTotalCount}
            hasMore={balanceHasMore}
            isLoadingMore={balanceLoadingMore}
            onLoadMore={loadMoreBalances}
            noun="balances"
          />
        </div>
      )
    ) : sortedAdjustmentRows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No adjustments match the current filters.
        </div>
      </div>
    ) : (
      <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
        <StockAdjustmentsTable
          rows={sortedAdjustmentRows}
          columnPrefs={activeAdjustmentColumnPrefs}
          sortField={prefs.adjustmentSortField}
          sortDirection={prefs.adjustmentSortDirection}
          frozenColumnCount={prefs.frozenColumnCount}
          onSortChange={handleAdjustmentSortChange}
          onColumnWidthChange={(columnId: StockAdjustmentColumnId, width: number | null) =>
            setPrefs((current) => setStockColumnWidth(current, deviceClass, columnId, width))
          }
          selectedId={selectedDrawerId}
          onSelect={handleSelectAdjustment}
        />
        <ListLoadMoreFooter
          visibleCount={adjustments.length}
          totalCount={adjustmentServerTotalCount}
          hasMore={adjustmentHasMore}
          isLoadingMore={adjustmentLoadingMore}
          onLoadMore={loadMoreAdjustments}
          noun="adjustments"
        />
      </div>
    );

  const balanceListFooter = (
    <ListLoadMoreFooter
      visibleCount={balances.length}
      totalCount={balanceServerTotalCount}
      hasMore={balanceHasMore}
      isLoadingMore={balanceLoadingMore}
      onLoadMore={loadMoreBalances}
      noun="balances"
    />
  );

  const adjustmentListFooter = (
    <ListLoadMoreFooter
      visibleCount={adjustments.length}
      totalCount={adjustmentServerTotalCount}
      hasMore={adjustmentHasMore}
      isLoadingMore={adjustmentLoadingMore}
      onLoadMore={loadMoreAdjustments}
      noun="adjustments"
    />
  );

  const splitListPrimary = isBalancesView ? (
    buildCatalogSplitListPane({
      rows: sortedBalanceRows,
      selectedId: peekBalance?.id ?? null,
      onSelect: handleSelectBalance,
      mapRow: mapStockBalanceRowToSplitFeed,
      hasAnyData,
      emptyMessage: "No balances match the current filters.",
      footer: balanceListFooter,
      empty: (
        <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
          <StockEmptyState
            viewMode={prefs.viewMode}
            onCreate={drawer.openCreate}
            hasLocations={locations.length > 0}
          />
        </div>
      ),
      filteredEmpty: (
        <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
          <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No balances match the current filters.
          </div>
        </div>
      ),
    })
  ) : isAdjustmentsView ? (
    buildCatalogSplitListPane({
      rows: sortedAdjustmentRows,
      selectedId: selectedDrawerId,
      onSelect: handleSelectAdjustment,
      mapRow: mapStockAdjustmentRowToSplitFeed,
      hasAnyData,
      emptyMessage: "No adjustments match the current filters.",
      footer: adjustmentListFooter,
      empty: (
        <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
          <StockEmptyState
            viewMode={prefs.viewMode}
            onCreate={drawer.openCreate}
            hasLocations={locations.length > 0}
          />
        </div>
      ),
      filteredEmpty: (
        <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
          <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No adjustments match the current filters.
          </div>
        </div>
      ),
    })
  ) : (
    listPrimary
  );

  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <>
      <ListModuleShell
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Stock"
            count={hasAnyData ? `${resultCount}/${totalCount}` : undefined}
            onNew={drawer.openCreate}
            newAriaLabel="New adjustment"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={
              hasAnyData ? (
                <StockListToolbar
                  prefs={prefs}
                  onPrefsChange={setPrefs}
                  locations={locations}
                  resultCount={resultCount}
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
          splitEmptyTitle="Select a stock record"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      {drawer.isOpen ? (
        <StockDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface}
          locations={locations}
          peekAdjustment={peekAdjustment}
          peekBalance={peekBalance}
          onAdjustBalance={handleAdjustBalance}
          createPrefill={createPrefill}
          onClose={drawer.close}
          onAfterSave={handleAfterSave}
        />
      ) : null}
      </>
    </ListWorkspaceModuleFrame>
  );
}
