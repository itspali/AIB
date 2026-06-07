"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Info, Plus } from "lucide-react";
import { loadStockTransfers } from "@/app/inventory/transfers/actions";
import { TransferDrawerForm } from "@/components/inventory/transfers/transfer-drawer-form";
import { TransferEmptyState } from "@/components/inventory/transfers/transfer-empty-state";
import { TransferListTable } from "@/components/inventory/transfers/transfer-list-table";
import { TransferListToolbar } from "@/components/inventory/transfers/transfer-list-toolbar";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { StockTransferRow, TransferLocationOption } from "@/lib/inventory/transfers/types";
import { useFilteredTransfers } from "@/lib/inventory/transfers/use-filtered-transfers";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const TRANSFERS_PAGE_DESCRIPTION =
  "Move quantity-tracked stock between locations — draft, dispatch, and confirm receipt.";

type Props = {
  initialTransfers: StockTransferRow[];
  locations: TransferLocationOption[];
};

function TransfersPageTitleHeader({ onNewTransfer }: { onNewTransfer: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2.5 sm:mb-5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">Transfers</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="About Transfers"
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3">
            <p className="text-sm leading-snug text-muted-foreground">
              {TRANSFERS_PAGE_DESCRIPTION}
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button type="button" className="shrink-0 gap-1.5" onClick={onNewTransfer}>
        <Plus className="h-4 w-4" aria-hidden />
        New transfer
      </Button>
    </div>
  );
}

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
  const filteredRows = transfersView.filteredRows;

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <TransferEmptyState
        onCreate={drawer.openCreate}
        hasLocations={locations.length >= 2}
      />
    </div>
  ) : filteredRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No transfers match the current filters.
      </div>
    </div>
  ) : (
    <TransferListTable
      rows={filteredRows}
      selectedId={selectedTransferId}
      onSelect={handleSelectTransfer}
    />
  );

  return (
    <>
      <ListModuleShell
        title={<TransfersPageTitleHeader onNewTransfer={drawer.openCreate} />}
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
        <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-hidden px-1">
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
