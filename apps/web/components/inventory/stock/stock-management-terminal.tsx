"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  loadPromoInventoryBalances,
  loadPromotionalReclassificationBatches,
  loadStockAdjustments,
  loadStockBalances,
} from "@/app/inventory/stock/actions";
import { StockAdjustmentsTable } from "@/components/inventory/stock/stock-adjustments-table";
import { StockBalancesTable } from "@/components/inventory/stock/stock-balances-table";
import { StockDrawerForm } from "@/components/inventory/stock/stock-drawer-form";
import { StockEmptyState } from "@/components/inventory/stock/stock-empty-state";
import { StockListToolbar } from "@/components/inventory/stock/stock-list-toolbar";
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
import { StockPoolSplitSummary } from "@/components/inventory/stock/stock-pool-split-summary";
import { PromoFulfillmentShipmentNotice } from "@/components/inventory/stock/promo-fulfillment-shipment-notice";
import { PromoReclassificationPanel } from "@/components/inventory/stock/promo-reclassification-panel";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import {
  attachPromoQuantitiesToBalances,
  buildPromoQtyMap,
} from "@/lib/inventory/stock/promo-pool-helpers";
import type { PromotionalBatchRow } from "@/lib/procurement/promo/reclassification-helpers";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const STOCK_PAGE_DESCRIPTION =
  "Review on-hand balances by location and post location-scoped stock adjustments.";

type Props = {
  initialBalances: StockBalanceRow[];
  initialAdjustments: StockAdjustmentRow[];
  initialPromoBalances?: PromoInventoryBalanceRow[];
  initialDraftBatches?: PromotionalBatchRow[];
  locations: StockLocationOption[];
};

export function StockManagementTerminal({
  initialBalances,
  initialAdjustments,
  initialPromoBalances = [],
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
      const [nextBalances, nextAdjustments, nextPromoBalances, nextDraftBatches] =
        await Promise.all([
          loadStockBalances(),
          loadStockAdjustments(),
          loadPromoInventoryBalances(),
          loadPromotionalReclassificationBatches(),
        ]);
      setBalances(nextBalances);
      setAdjustments(nextAdjustments);
      setPromoBalances(nextPromoBalances);
      setDraftBatches(nextDraftBatches);
    });
  }, []);

  const balancesView = useFilteredStockBalances(balances, prefs.locationId);
  const adjustmentsView = useFilteredStockAdjustments(adjustments, prefs.locationId);

  const isBalancesView = prefs.viewMode === "balances";
  const resultCount = isBalancesView
    ? balancesView.resultCount
    : adjustmentsView.resultCount;
  const totalCount = isBalancesView ? balancesView.totalCount : adjustmentsView.totalCount;

  const selectedAdjustmentId = drawer.recordId;
  const peekAdjustment =
    selectedAdjustmentId != null
      ? (adjustments.find((row) => row.id === selectedAdjustmentId) ?? null)
      : null;

  const handleSelectAdjustment = useCallback(
    (adjustmentId: string) => {
      drawer.openPeek(adjustmentId);
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

  const hasAnyData = balances.length > 0 || adjustments.length > 0;

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
          selectedId={null}
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
        selectedId={selectedAdjustmentId}
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
          <StockPoolSplitSummary sellableRows={balances} promoBalances={promoBalances} />
          <PromoFulfillmentShipmentNotice visible={promoBalances.length > 0} />
          <PromoReclassificationPanel
            balances={promoBalances}
            draftBatches={draftBatches}
            onChanged={refreshPromoData}
          />
          {listPrimary}
        </div>
      </ListModuleShell>

      <StockDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        locations={locations}
        peekAdjustment={peekAdjustment}
        createPrefill={createPrefill}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
      />
    </>
  );
}
