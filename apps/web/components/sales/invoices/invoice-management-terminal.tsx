"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadSalesInvoices } from "@/app/sales/invoices/actions";
import { InvoiceDrawerForm } from "@/components/sales/invoices/invoice-drawer-form";
import { InvoiceEmptyState } from "@/components/sales/invoices/invoice-empty-state";
import { InvoiceListTable } from "@/components/sales/invoices/invoice-list-table";
import { InvoiceListToolbar } from "@/components/sales/invoices/invoice-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultSalesInvoiceListPrefs,
  loadSalesInvoiceListPrefs,
  saveSalesInvoiceListPrefs,
  setSalesInvoiceColumnWidth,
  type SalesInvoiceListPrefs,
} from "@/lib/sales/invoices/list-prefs";
import {
  sortSalesInvoiceListRows,
  type SalesInvoiceListSortDirection,
  type SalesInvoiceListSortField,
} from "@/lib/sales/invoices/list-sort";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import { useFilteredInvoices } from "@/lib/sales/invoices/use-filtered-invoices";
import {
  INVOICE_DRAWER_SO_PARAM,
  INVOICE_STATUS_FILTER_PARAM,
  SALES_INVOICES_HREF,
} from "@/lib/sales/navigation";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";

const INVOICE_PAGE_DESCRIPTION =
  "Issue customer invoices, post to accounts receivable, and track payment status.";

type Props = {
  initialInvoices: SalesInvoiceRow[];
  customers: CustomerOption[];
  locations: SalesLocationOption[];
  editAccessGranted: boolean;
};

export function InvoiceManagementTerminal({
  initialInvoices,
  customers,
  locations,
  editAccessGranted,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(SALES_INVOICES_HREF, {
    clearParamsOnClose: [INVOICE_DRAWER_SO_PARAM, INVOICE_STATUS_FILTER_PARAM],
  });
  const [invoices, setInvoices] = useState(initialInvoices);
  const [prefs, setPrefs] = useState<SalesInvoiceListPrefs>(getDefaultSalesInvoiceListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadSalesInvoiceListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get(INVOICE_STATUS_FILTER_PARAM)?.trim();
    if (!statusParam || statusParam === "all") return;
    setPrefs((current) =>
      current.status === statusParam
        ? current
        : { ...current, status: statusParam as SalesDocumentStatus | "all" }
    );
  }, [searchParams]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveSalesInvoiceListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      try {
        const nextInvoices = await loadSalesInvoices();
        setInvoices(nextInvoices);
      } catch (error) {
        console.error("[InvoiceManagementTerminal] refresh failed", error);
        toast.error(error instanceof Error ? error.message : "Unable to refresh invoices.");
      }
    });
  }, []);

  const invoicesView = useFilteredInvoices(invoices, prefs);
  const selectedId = drawer.recordId;
  const peekInvoice =
    selectedId != null && drawer.surface === "peek"
      ? (invoices.find((row) => row.id === selectedId) ?? null)
      : null;
  const editInvoiceId = drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const createPrefillSoId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(INVOICE_DRAWER_SO_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);

  const handleSelect = useCallback(
    (invoiceId: string) => {
      drawer.openPeek(invoiceId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (invoiceId: string) => {
      refreshList();
      drawer.afterSave(invoiceId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (invoiceId: string) => {
      const invoice = invoices.find((row) => row.id === invoiceId);
      if (invoice && (!editAccessGranted || !canEditSalesDocument(invoice.commercial_status))) {
        drawer.openPeek(invoiceId);
        return;
      }
      drawer.openEdit(invoiceId);
    },
    [drawer, editAccessGranted, invoices]
  );

  useEffect(() => {
    if (!editAccessGranted && (drawer.surface === "create" || drawer.surface === "edit")) {
      if (drawer.recordId) drawer.openPeek(drawer.recordId);
      else drawer.close();
    }
  }, [drawer, editAccessGranted]);

  const hasAnyData = invoices.length > 0;
  const sortedRows = useMemo(
    () => sortSalesInvoiceListRows(invoicesView.filteredRows, prefs.sortField, prefs.sortDirection),
    [invoicesView.filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const handleSortChange = useCallback(
    (field: SalesInvoiceListSortField, direction: SalesInvoiceListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <InvoiceEmptyState onCreate={drawer.openCreate} hasCustomers={customers.length > 0} />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No invoices match the current filters.
      </div>
    </div>
  ) : (
    <InvoiceListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      onColumnWidthChange={(columnId, width) =>
        setPrefs((current) => setSalesInvoiceColumnWidth(current, columnId, width))
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
            title="Invoices"
            description={INVOICE_PAGE_DESCRIPTION}
            createLabel="New invoice"
            onCreate={editAccessGranted ? drawer.openCreate : undefined}
            aboutAriaLabel="About Sales Invoices"
          />
        }
        toolbar={
          hasAnyData ? (
            <InvoiceListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              customers={customers}
              resultCount={invoicesView.resultCount}
              totalCount={invoicesView.totalCount}
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

      <InvoiceDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        customers={customers}
        locations={locations}
        peekInvoice={peekInvoice}
        peekRecordId={selectedId}
        editInvoiceId={editInvoiceId}
        createPrefillSoId={createPrefillSoId}
        editAccessGranted={editAccessGranted}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
        onOpenEdit={handleOpenEdit}
      />
    </>
  );
}
