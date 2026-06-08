"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loadStockTransfers } from "@/app/inventory/transfers/actions";
import { TransferDrawerForm } from "@/components/inventory/transfers/transfer-drawer-form";
import { TransferEmptyState } from "@/components/inventory/transfers/transfer-empty-state";
import { TransferListTable } from "@/components/inventory/transfers/transfer-list-table";
import { TransferListToolbar } from "@/components/inventory/transfers/transfer-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultTransferListPrefs,
  loadTransferListPrefs,
  saveTransferListPrefs,
  type TransferListPrefs,
} from "@/lib/inventory/transfers/list-prefs";
import {
  TRANSFER_DRAWER_DEST_PARAM,
  TRANSFER_DRAWER_SOURCE_PARAM,
  TRANSFERS_HREF,
} from "@/lib/inventory/transfers/navigation";
import {
  sortTransferListRows,
  type TransferListSortDirection,
  type TransferListSortField,
} from "@/lib/inventory/transfers/list-sort";
import type { StockTransferRow, TransferLocationOption } from "@/lib/inventory/transfers/types";
import { useFilteredTransfers } from "@/lib/inventory/transfers/use-filtered-transfers";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const TRANSFERS_PAGE_DESCRIPTION =
  "Move quantity-tracked stock between locations — draft, dispatch, and confirm receipt.";

type Props = {
  initialTransfers: StockTransferRow[];
  locations: TransferLocationOption[];
};

export function TransferManagementTerminal({ initialTransfers, locations }: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(TRANSFERS_HREF, {
    clearParamsOnClose: [TRANSFER_DRAWER_SOURCE_PARAM, TRANSFER_DRAWER_DEST_PARAM],
  });
  const [transfers, setTransfers] = useState(initialTransfers);
  const [prefs, setPrefs] = useState<TransferListPrefs>(getDefaultTransferListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadTransferListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveTransferListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      const nextTransfers = await loadStockTransfers();
      setTransfers(nextTransfers);
    });
  }, []);

  const transfersView = useFilteredTransfers(transfers, prefs);

  const selectedTransferId = drawer.recordId;
  const peekTransfer =
    selectedTransferId != null && drawer.surface === "peek"
      ? (transfers.find((row) => row.id === selectedTransferId) ?? null)
      : null;

  const editTransferId =
    drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const createPrefill = useMemo(() => {
    if (drawer.surface !== "create") return null;

    const variantId = drawer.variantId;
    const sourceLocationId = searchParams.get(TRANSFER_DRAWER_SOURCE_PARAM)?.trim() ?? "";
    const destinationLocationId = searchParams.get(TRANSFER_DRAWER_DEST_PARAM)?.trim() ?? "";

    if (!variantId && !destinationLocationId && !sourceLocationId) return null;

    return {
      source_location_id: sourceLocationId,
      destination_location_id: destinationLocationId,
      variant_id: variantId ?? "",
      variant_sku: "",
      item_name: "",
    };
  }, [drawer.surface, drawer.variantId, searchParams]);

  const handleSelectTransfer = useCallback(
    (transferId: string) => {
      drawer.openPeek(transferId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (transferId: string) => {
      refreshList();
      drawer.afterSave(transferId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (transferId: string) => {
      drawer.openEdit(transferId);
    },
    [drawer]
  );

  const hasAnyData = transfers.length > 0;

  const sortedRows = useMemo(
    () =>
      sortTransferListRows(
        transfersView.filteredRows,
        prefs.sortField,
        prefs.sortDirection
      ),
    [transfersView.filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const handleSortChange = useCallback(
    (field: TransferListSortField, direction: TransferListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <TransferEmptyState
        onCreate={drawer.openCreate}
        hasLocations={locations.length >= 2}
      />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No transfers match the current filters.
      </div>
    </div>
  ) : (
    <TransferListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      selectedId={selectedTransferId}
      onSelect={handleSelectTransfer}
    />
  );

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Transfers"
            description={TRANSFERS_PAGE_DESCRIPTION}
            createLabel="New transfer"
            onCreate={drawer.openCreate}
            aboutAriaLabel="About Transfers"
          />
        }
        toolbar={
          hasAnyData ? (
            <TransferListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              locations={locations}
              resultCount={transfersView.resultCount}
              totalCount={transfersView.totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
      >
        <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-auto">
          {listPrimary}
        </div>
      </ListModuleShell>

      <TransferDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        locations={locations}
        peekTransfer={peekTransfer}
        editTransferId={editTransferId}
        createPrefill={createPrefill}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
        onOpenEdit={handleOpenEdit}
      />
    </>
  );
}
