"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  bulkApproveSalesInvoices,
  bulkPostSalesInvoices,
  loadSalesInvoices,
} from "@/app/sales/invoices/actions";
import { InvoiceDrawerForm } from "@/components/sales/invoices/invoice-drawer-form";
import { InvoiceEmptyState } from "@/components/sales/invoices/invoice-empty-state";
import { InvoiceListTable } from "@/components/sales/invoices/invoice-list-table";
import { InvoiceListToolbar } from "@/components/sales/invoices/invoice-list-toolbar";
import { SalesBulkActionToolbar } from "@/components/sales/shared/sales-bulk-action-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { notifyApprovalAlertChanged } from "@/lib/layout/approval-alert-events";
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
  INVOICE_DRAWER_QUOTE_PARAM,
  INVOICE_DRAWER_SO_PARAM,
  INVOICE_STATUS_FILTER_PARAM,
  SALES_INVOICES_HREF,
} from "@/lib/sales/navigation";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import {
  canUserApproveSalesInvoices,
  isSalesInvoiceApprovableByUser,
  isSalesInvoicePostableByUser,
} from "@/lib/sales/approval-settings";

const INVOICE_PAGE_DESCRIPTION =
  "Issue customer invoices, post to accounts receivable, and track payment status.";

function resolveBulkInvoiceIds(
  bulkSelectAllMatching: boolean,
  bulkSelectedIds: Set<string>,
  matchingIds: string[]
): string[] {
  if (bulkSelectAllMatching) return matchingIds;
  return [...bulkSelectedIds];
}

type Props = {
  initialInvoices: SalesInvoiceRow[];
  customers: CustomerOption[];
  locations: SalesLocationOption[];
  editAccessGranted: boolean;
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  defaultCurrency?: string;
  documentLayout: DocumentLayoutTemplate;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  tenantCountry?: string | null;
  gstRegistered?: boolean;
  approvalSettings: SalesApprovalSettings;
  currentUserId: string;
  isOwner: boolean;
};

export function InvoiceManagementTerminal({
  initialInvoices,
  customers,
  locations,
  editAccessGranted,
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  defaultCurrency = "USD",
  documentLayout,
  taxCodeOptions = [],
  tenantCountry = null,
  gstRegistered = false,
  approvalSettings,
  currentUserId,
  isOwner,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(SALES_INVOICES_HREF, {
    clearParamsOnClose: [
      INVOICE_DRAWER_SO_PARAM,
      INVOICE_DRAWER_QUOTE_PARAM,
      INVOICE_STATUS_FILTER_PARAM,
    ],
  });
  const [invoices, setInvoices] = useState(initialInvoices);
  const [prefs, setPrefs] = useState<SalesInvoiceListPrefs>(getDefaultSalesInvoiceListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  const canBulkApprove = canUserApproveSalesInvoices(currentUserId, approvalSettings, { isOwner });
  const canBulkPost = editAccessGranted;

  const isRowBulkApprovable = useCallback(
    (row: SalesInvoiceRow) => {
      if (!canBulkApprove) return false;
      if (isOwner) return row.commercial_status === "PENDING_APPROVAL";
      return isSalesInvoiceApprovableByUser(row, currentUserId, approvalSettings, { isOwner });
    },
    [approvalSettings, canBulkApprove, currentUserId, isOwner]
  );

  const isRowBulkPostable = useCallback(
    (row: SalesInvoiceRow) =>
      canBulkPost &&
      isSalesInvoicePostableByUser(row, approvalSettings, currentUserId, {
        isOwner,
        editAccessGranted,
      }),
    [approvalSettings, canBulkPost, currentUserId, editAccessGranted, isOwner]
  );

  const isRowBulkSelectable = useCallback(
    (row: SalesInvoiceRow) => isRowBulkApprovable(row) || isRowBulkPostable(row),
    [isRowBulkApprovable, isRowBulkPostable]
  );

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

  const createPrefillQuoteId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(INVOICE_DRAWER_QUOTE_PARAM)?.trim() || null;
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
  const filteredRows = invoicesView.filteredRows;
  const sortedRows = useMemo(
    () => sortSalesInvoiceListRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const selectableMatchingIds = useMemo(
    () => filteredRows.filter(isRowBulkSelectable).map((row) => row.id),
    [filteredRows, isRowBulkSelectable]
  );

  const selectableVisibleIds = useMemo(
    () => sortedRows.filter(isRowBulkSelectable).map((row) => row.id),
    [isRowBulkSelectable, sortedRows]
  );

  const pageAllSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => bulkSelectedIds.has(id));
  const pageSomeSelected =
    selectableVisibleIds.some((id) => bulkSelectedIds.has(id)) && !pageAllSelected;

  const bulkSelectionCount = bulkSelectAllMatching
    ? selectableMatchingIds.length
    : bulkSelectedIds.size;

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const resolveSelectedIds = useCallback(
    () => resolveBulkInvoiceIds(bulkSelectAllMatching, bulkSelectedIds, selectableMatchingIds),
    [bulkSelectAllMatching, bulkSelectedIds, selectableMatchingIds]
  );

  const rowById = useMemo(() => new Map(invoices.map((row) => [row.id, row])), [invoices]);

  const filterSelectedApprovableIds = useCallback(
    (ids: string[]) =>
      ids.filter((id) => {
        const row = rowById.get(id);
        return row != null && isRowBulkApprovable(row);
      }),
    [isRowBulkApprovable, rowById]
  );

  const filterSelectedPostableIds = useCallback(
    (ids: string[]) =>
      ids.filter((id) => {
        const row = rowById.get(id);
        return row != null && isRowBulkPostable(row);
      }),
    [isRowBulkPostable, rowById]
  );

  const handleBulkRowToggle = useCallback((invoiceId: string, checked: boolean) => {
    setBulkSelectAllMatching(false);
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(invoiceId);
      else next.delete(invoiceId);
      return next;
    });
  }, []);

  const handleBulkPageToggle = useCallback(
    (checked: boolean) => {
      setBulkSelectAllMatching(false);
      setBulkSelectedIds((current) => {
        const next = new Set(current);
        for (const id of selectableVisibleIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [selectableVisibleIds]
  );

  const handleBulkApprove = useCallback(() => {
    const ids = filterSelectedApprovableIds(resolveSelectedIds());
    if (ids.length === 0) {
      toast.error("Select at least one invoice pending your approval.");
      return;
    }

    startBulkTransition(async () => {
      const result = await bulkApproveSalesInvoices({ sales_invoice_ids: ids });
      if (result.success !== true) {
        toast.error(result.error ?? "Unable to approve the selected invoices.");
        return;
      }

      const approvedCount = result.approvedIds.length;
      const failedCount = result.failures.length;
      if (failedCount > 0) {
        toast.success(
          `${approvedCount} ${approvedCount === 1 ? "invoice" : "invoices"} approved; ${failedCount} could not be approved.`
        );
      } else {
        toast.success(`${approvedCount} ${approvedCount === 1 ? "invoice" : "invoices"} approved`);
      }
      clearBulkSelection();
      refreshList();
      notifyApprovalAlertChanged();
    });
  }, [clearBulkSelection, filterSelectedApprovableIds, refreshList, resolveSelectedIds]);

  const handleBulkPost = useCallback(() => {
    const ids = filterSelectedPostableIds(resolveSelectedIds());
    if (ids.length === 0) {
      toast.error("Select at least one invoice that can be posted.");
      return;
    }

    startBulkTransition(async () => {
      const result = await bulkPostSalesInvoices({ sales_invoice_ids: ids });
      if (result.success !== true) {
        toast.error(result.error ?? "Unable to post the selected invoices.");
        return;
      }

      const postedCount = result.postedIds.length;
      const failedCount = result.failures.length;
      if (failedCount > 0) {
        toast.success(
          `${postedCount} ${postedCount === 1 ? "invoice" : "invoices"} posted; ${failedCount} could not be posted.`
        );
      } else {
        toast.success(`${postedCount} ${postedCount === 1 ? "invoice" : "invoices"} posted`);
      }
      clearBulkSelection();
      refreshList();
    });
  }, [clearBulkSelection, filterSelectedPostableIds, refreshList, resolveSelectedIds]);

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
      bulkSelectionEnabled={canBulkApprove || canBulkPost}
      bulkSelectedIds={bulkSelectedIds}
      pageAllSelected={pageAllSelected}
      pageSomeSelected={pageSomeSelected}
      isRowBulkSelectable={isRowBulkSelectable}
      onBulkRowToggle={handleBulkRowToggle}
      onBulkPageToggle={handleBulkPageToggle}
    />
  );

  const bulkToolbar =
    hasAnyData && (canBulkApprove || canBulkPost) && bulkSelectionCount > 0 ? (
      <SalesBulkActionToolbar
        entitySingular="invoice"
        entityPlural="invoices"
        selectionMenuLabel="Select invoices for bulk actions"
        ariaLabel="Bulk invoice actions"
        selectedCount={bulkSelectedIds.size}
        totalMatchingCount={selectableMatchingIds.length}
        selectAllMatching={bulkSelectAllMatching}
        pageAllSelected={pageAllSelected}
        visibleCount={selectableVisibleIds.length}
        isPending={isBulkPending}
        pendingLabel="Processing invoices"
        onClearSelection={clearBulkSelection}
        onSelectPage={() => handleBulkPageToggle(true)}
        onSelectAllMatching={() => {
          setBulkSelectAllMatching(true);
          setBulkSelectedIds(new Set(selectableMatchingIds));
        }}
        onApprove={canBulkApprove ? handleBulkApprove : undefined}
        onConfirm={canBulkPost ? handleBulkPost : undefined}
        confirmLabel="Post"
        embedded
      />
    ) : null;

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
        bulkToolbar={bulkToolbar}
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
        createPrefillQuoteId={createPrefillQuoteId}
        editAccessGranted={editAccessGranted}
        defaultCurrency={defaultCurrency}
        documentLayout={documentLayout}
        allowLineItemDiscounts={allowLineItemDiscounts}
        allowTransactionDiscounts={allowTransactionDiscounts}
        taxCodeOptions={taxCodeOptions}
        tenantCountry={tenantCountry}
        gstRegistered={gstRegistered}
        approvalSettings={approvalSettings}
        currentUserId={currentUserId}
        isOwner={isOwner}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
        onOpenEdit={handleOpenEdit}
      />
    </>
  );
}
