"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  loadPromoInventoryBalances,
  loadPromotionalReclassificationBatches,
  loadQcInventoryBalances,
  loadStockAdjustments,
  loadStockBalances,
} from "@/app/inventory/stock/actions";
import { StockAdjustmentsTable } from "@/components/inventory/stock/stock-adjustments-table";
import { StockBalancesTable } from "@/components/inventory/stock/stock-balances-table";
import { StockDrawerForm } from "@/components/inventory/stock/stock-drawer-form";
import { StockEmptyState } from "@/components/inventory/stock/stock-empty-state";
import { StockInventoryPoolsView } from "@/components/inventory/stock/stock-inventory-pools-view";
import { StockListToolbar } from "@/components/inventory/stock/stock-list-toolbar";
import { StockPromoReclassificationView } from "@/components/inventory/stock/stock-promo-reclassification-view";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultStockListPrefs,
  loadStockListPrefs,
  saveStockListPrefs,
  setStockColumnWidth,
  setStockSortPrefs,
  type StockListPrefs,
} from "@/lib/inventory/stock/list-prefs";
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

const STOCK_PAGE_DESCRIPTION =
  "Review on-hand balances by location and post location-scoped stock adjustments.";

type Props = {
  initialBalances: StockBalanceRow[];
  initialAdjustments: StockAdjustmentRow[];
  initialPromoBalances?: PromoInventoryBalanceRow[];
  initialQcBalances?: QcInventoryBalanceRow[];
  initialDraftBatches?: PromotionalBatchRow[];
  locations: StockLocationOption[];
};

export function StockManagementTerminal({
  initialBalances,
  initialAdjustments,
  initialPromoBalances = [],
  initialQcBalances = [],
  initialDraftBatches = [],
  locations,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(STOCK_HREF, {
    clearParamsOnClose: [STOCK_DRAWER_LOCATION_PARAM],
  });
  const [balances, setBalances] = useState(initialBalances);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [promoBalances, setPromoBalances] = useState(initialPromoBalances);
  const [qcBalances, setQcBalances] = useState(initialQcBalances);
  const [draftBatches, setDraftBatches] = useState(initialDraftBatches);
  const [prefs, setPrefs] = useState<StockListPrefs>(getDefaultStockListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadStockListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveStockListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const refreshLists = useCallback(() => {
    startRefreshTransition(async () => {
      const [nextBalances, nextAdjustments] = await Promise.all([
        loadStockBalances(),
        loadStockAdjustments(),
      ]);
      setBalances(nextBalances);
      setAdjustments(nextAdjustments);
    });
  }, []);

  const refreshPromoData = useCallback(() => {
    startRefreshTransition(async () => {
      const [nextBalances, nextAdjustments, nextPromoBalances, nextQcBalances, nextDraftBatches] =
        await Promise.all([
          loadStockBalances(),
          loadStockAdjustments(),
          loadPromoInventoryBalances(),
          loadQcInventoryBalances(),
          loadPromotionalReclassificationBatches(),
        ]);
      setBalances(nextBalances);
      setAdjustments(nextAdjustments);
      setPromoBalances(nextPromoBalances);
      setQcBalances(nextQcBalances);
      setDraftBatches(nextDraftBatches);
    });
  }, []);

  const balancesView = useFilteredStockBalances(balances, prefs.locationId);
  const adjustmentsView = useFilteredStockAdjustments(adjustments, prefs.locationId);

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
    ? balancesView.totalCount
    : isAdjustmentsView
      ? adjustmentsView.totalCount
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
        attachPromoQuantitiesToBalances(balancesView.filteredRows, promoQtyMap),
        prefs.balanceSortField,
        prefs.balanceSortDirection
      ),
    [balancesView.filteredRows, promoQtyMap, prefs.balanceSortField, prefs.balanceSortDirection]
  );

  const sortedAdjustmentRows = useMemo(
    () =>
      sortStockAdjustmentRows(
        adjustmentsView.filteredRows,
        prefs.adjustmentSortField,
        prefs.adjustmentSortDirection
      ),
    [adjustmentsView.filteredRows, prefs.adjustmentSortField, prefs.adjustmentSortDirection]
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
        <StockBalancesTable
          rows={sortedBalanceRows}
          columnPrefs={prefs.balanceColumnPrefs}
          sortField={prefs.balanceSortField}
          sortDirection={prefs.balanceSortDirection}
          frozenColumnCount={prefs.frozenColumnCount}
          onSortChange={handleBalanceSortChange}
          onColumnWidthChange={(columnId, width) =>
            setPrefs((current) => setStockColumnWidth(current, columnId, width))
          }
          selectedId={peekBalance?.id ?? null}
          onSelect={(row) => handleSelectBalance(row.id)}
          onAdjust={handleAdjustBalance}
        />
      )
    ) : sortedAdjustmentRows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No adjustments match the current filters.
        </div>
      </div>
    ) : (
      <StockAdjustmentsTable
        rows={sortedAdjustmentRows}
        columnPrefs={prefs.adjustmentColumnPrefs}
        sortField={prefs.adjustmentSortField}
        sortDirection={prefs.adjustmentSortDirection}
        frozenColumnCount={prefs.frozenColumnCount}
        onSortChange={handleAdjustmentSortChange}
        onColumnWidthChange={(columnId, width) =>
          setPrefs((current) => setStockColumnWidth(current, columnId, width))
        }
        selectedId={selectedDrawerId}
        onSelect={handleSelectAdjustment}
      />
    );

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Stock"
            description={STOCK_PAGE_DESCRIPTION}
            createLabel="New adjustment"
            onCreate={drawer.openCreate}
            aboutAriaLabel="About Stock"
          />
        }
        toolbar={
          hasAnyData ? (
            <StockListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              locations={locations}
              resultCount={resultCount}
              totalCount={totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{listPrimary}</div>
        </div>
      </ListModuleShell>

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
    </>
  );
}
