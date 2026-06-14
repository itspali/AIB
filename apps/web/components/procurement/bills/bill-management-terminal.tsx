"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadPurchaseBills } from "@/app/procurement/bills/actions";
import { BillDrawerForm } from "@/components/procurement/bills/bill-drawer-form";
import { BillEmptyState } from "@/components/procurement/bills/bill-empty-state";
import { BillListTable } from "@/components/procurement/bills/bill-list-table";
import { BillListToolbar } from "@/components/procurement/bills/bill-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultPurchaseBillListPrefs,
  loadPurchaseBillListPrefs,
  savePurchaseBillListPrefs,
  setPurchaseBillColumnWidth,
  type PurchaseBillListPrefs,
} from "@/lib/procurement/bills/list-prefs";
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
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const BILL_PAGE_DESCRIPTION =
  "Record vendor invoices, link goods receipts, and run three-way matching.";

type Props = {
  initialBills: PurchaseBillRow[];
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
  suppliers,
  locations,
  billableOrders,
  matchingTolerancePct,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(PROCUREMENT_BILLS_HREF, {
    clearParamsOnClose: [BILL_DRAWER_PO_PARAM, BILL_MATCH_STATUS_FILTER_PARAM, BILL_PAID_FILTER_PARAM],
  });
  const [bills, setBills] = useState(initialBills);
  const [prefs, setPrefs] = useState<PurchaseBillListPrefs>(getDefaultPurchaseBillListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

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

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      try {
        const nextBills = await loadPurchaseBills();
        setBills(nextBills);
      } catch (error) {
        console.error("[BillManagementTerminal] refresh failed", error);
        toast.error(error instanceof Error ? error.message : "Unable to refresh supplier bills.");
      }
    });
  }, []);

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

  const sortedRows = useMemo(
    () => sortPurchaseBillListRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
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
    <BillListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      onColumnWidthChange={(columnId, width) =>
        setPrefs((current) => setPurchaseBillColumnWidth(current, columnId, width))
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
            title="Supplier bills"
            description={BILL_PAGE_DESCRIPTION}
            createLabel="New bill"
            onCreate={drawer.openCreate}
            aboutAriaLabel="About Supplier Bills"
          />
        }
        toolbar={
          hasAnyData ? (
            <BillListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              suppliers={suppliers}
              resultCount={billsView.resultCount}
              totalCount={billsView.totalCount}
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
    </>
  );
}
