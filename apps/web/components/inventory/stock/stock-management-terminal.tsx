"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Info, Plus } from "lucide-react";
import {
  loadStockAdjustments,
  loadStockBalances,
} from "@/app/inventory/stock/actions";
import { StockAdjustmentsTable } from "@/components/inventory/stock/stock-adjustments-table";
import { StockBalancesTable } from "@/components/inventory/stock/stock-balances-table";
import { StockDrawerForm } from "@/components/inventory/stock/stock-drawer-form";
import { StockEmptyState } from "@/components/inventory/stock/stock-empty-state";
import { StockListToolbar } from "@/components/inventory/stock/stock-list-toolbar";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getDefaultStockListPrefs,
  loadStockListPrefs,
  saveStockListPrefs,
  type StockListPrefs,
} from "@/lib/inventory/stock/list-prefs";
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
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const STOCK_PAGE_DESCRIPTION =
  "Review on-hand balances by location and post location-scoped stock adjustments.";

type Props = {
  initialBalances: StockBalanceRow[];
  initialAdjustments: StockAdjustmentRow[];
  locations: StockLocationOption[];
};

function StockPageTitleHeader({ onNewAdjustment }: { onNewAdjustment: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2.5 sm:mb-5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">Stock</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="About Stock"
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3">
            <p className="text-sm leading-snug text-muted-foreground">{STOCK_PAGE_DESCRIPTION}</p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button type="button" className="shrink-0 gap-1.5" onClick={onNewAdjustment}>
        <Plus className="h-4 w-4" aria-hidden />
        New adjustment
      </Button>
    </div>
  );
}

export function StockManagementTerminal({
  initialBalances,
  initialAdjustments,
  locations,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(STOCK_HREF, {
    clearParamsOnClose: [STOCK_DRAWER_LOCATION_PARAM],
  });
  const [balances, setBalances] = useState(initialBalances);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
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
  const filteredRows = isBalancesView
    ? balancesView.filteredRows
    : adjustmentsView.filteredRows;

  const listPrimary =
    !hasAnyData ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <StockEmptyState
          viewMode={prefs.viewMode}
          onCreate={drawer.openCreate}
          hasLocations={locations.length > 0}
        />
      </div>
    ) : filteredRows.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No {isBalancesView ? "balances" : "adjustments"} match the current filters.
        </div>
      </div>
    ) : isBalancesView ? (
      <StockBalancesTable
        rows={filteredRows as StockBalanceRow[]}
        selectedId={null}
        onAdjust={handleAdjustBalance}
      />
    ) : (
      <StockAdjustmentsTable
        rows={filteredRows as StockAdjustmentRow[]}
        selectedId={selectedAdjustmentId}
        onSelect={handleSelectAdjustment}
      />
    );

  return (
    <>
      <ListModuleShell
        title={<StockPageTitleHeader onNewAdjustment={drawer.openCreate} />}
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
        <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-hidden px-1">
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
