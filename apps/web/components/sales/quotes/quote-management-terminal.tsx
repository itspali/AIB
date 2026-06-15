"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadSalesQuotations } from "@/app/sales/quotes/actions";
import { QuoteDrawerForm } from "@/components/sales/quotes/quote-drawer-form";
import { QuoteEmptyState } from "@/components/sales/quotes/quote-empty-state";
import { QuoteListTable } from "@/components/sales/quotes/quote-list-table";
import { QuoteListToolbar } from "@/components/sales/quotes/quote-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultSalesQuoteListPrefs,
  loadSalesQuoteListPrefs,
  saveSalesQuoteListPrefs,
  setSalesQuoteColumnWidth,
  type SalesQuoteListPrefs,
} from "@/lib/sales/quotes/list-prefs";
import {
  sortSalesQuoteListRows,
  type SalesQuoteListSortDirection,
  type SalesQuoteListSortField,
} from "@/lib/sales/quotes/list-sort";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import { useFilteredQuotes } from "@/lib/sales/quotes/use-filtered-quotes";
import { QUOTE_STATUS_FILTER_PARAM, SALES_QUOTES_HREF } from "@/lib/sales/navigation";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import { canEditSalesDocument } from "@/lib/sales/shared/document-status";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesDocumentConversionMode } from "@/lib/sales/document-conversion-settings";

const QUOTE_PAGE_DESCRIPTION =
  "Create sales quotations, route them through approval, and convert to orders or invoices.";

type Props = {
  initialQuotes: SalesQuoteRow[];
  customers: CustomerOption[];
  locations: SalesLocationOption[];
  editAccessGranted: boolean;
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  defaultCurrency?: string;
  documentLayout: DocumentLayoutTemplate;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  tenantCountry?: string | null;
  preferredOriginLocationId?: string | null;
  documentConversionMode?: SalesDocumentConversionMode;
};

export function QuoteManagementTerminal({
  initialQuotes,
  customers,
  locations,
  editAccessGranted,
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  defaultCurrency = "USD",
  documentLayout,
  taxCodeOptions = [],
  tenantCountry = null,
  preferredOriginLocationId = null,
  documentConversionMode = "prefill_form",
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(SALES_QUOTES_HREF, {
    clearParamsOnClose: [QUOTE_STATUS_FILTER_PARAM],
  });
  const [quotes, setQuotes] = useState(initialQuotes);
  const [prefs, setPrefs] = useState<SalesQuoteListPrefs>(getDefaultSalesQuoteListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadSalesQuoteListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get(QUOTE_STATUS_FILTER_PARAM)?.trim();
    if (!statusParam || statusParam === "all") return;
    setPrefs((current) =>
      current.status === statusParam
        ? current
        : { ...current, status: statusParam as SalesDocumentStatus | "all" }
    );
  }, [searchParams]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveSalesQuoteListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      try {
        const nextQuotes = await loadSalesQuotations();
        setQuotes(nextQuotes);
      } catch (error) {
        console.error("[QuoteManagementTerminal] refresh failed", error);
        toast.error(error instanceof Error ? error.message : "Unable to refresh quotes.");
      }
    });
  }, []);

  const quotesView = useFilteredQuotes(quotes, prefs);
  const selectedId = drawer.recordId;
  const peekQuote =
    selectedId != null && drawer.surface === "peek"
      ? (quotes.find((row) => row.id === selectedId) ?? null)
      : null;
  const editQuoteId = drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const handleSelect = useCallback(
    (quoteId: string) => {
      drawer.openPeek(quoteId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (quoteId: string) => {
      refreshList();
      drawer.afterSave(quoteId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (quoteId: string) => {
      const quote = quotes.find((row) => row.id === quoteId);
      if (quote && (!editAccessGranted || !canEditSalesDocument(quote.commercial_status))) {
        drawer.openPeek(quoteId);
        return;
      }
      drawer.openEdit(quoteId);
    },
    [drawer, editAccessGranted, quotes]
  );

  useEffect(() => {
    if (!editAccessGranted && (drawer.surface === "create" || drawer.surface === "edit")) {
      if (drawer.recordId) drawer.openPeek(drawer.recordId);
      else drawer.close();
    }
  }, [drawer, editAccessGranted]);

  const hasAnyData = quotes.length > 0;
  const sortedRows = useMemo(
    () => sortSalesQuoteListRows(quotesView.filteredRows, prefs.sortField, prefs.sortDirection),
    [prefs.sortDirection, prefs.sortField, quotesView.filteredRows]
  );

  const handleSortChange = useCallback(
    (field: SalesQuoteListSortField, direction: SalesQuoteListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <QuoteEmptyState onCreate={drawer.openCreate} hasCustomers={customers.length > 0} />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No quotes match the current filters.
      </div>
    </div>
  ) : (
    <QuoteListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      onColumnWidthChange={(columnId, width) =>
        setPrefs((current) => setSalesQuoteColumnWidth(current, columnId, width))
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
            title="Quotes"
            description={QUOTE_PAGE_DESCRIPTION}
            createLabel="New quote"
            onCreate={editAccessGranted ? drawer.openCreate : undefined}
            aboutAriaLabel="About Sales Quotes"
          />
        }
        toolbar={
          hasAnyData ? (
            <QuoteListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              customers={customers}
              resultCount={quotesView.resultCount}
              totalCount={quotesView.totalCount}
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

      <QuoteDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        customers={customers}
        locations={locations}
        peekQuote={peekQuote}
        peekRecordId={selectedId}
        editQuoteId={editQuoteId}
        editAccessGranted={editAccessGranted}
        defaultCurrency={defaultCurrency}
        documentLayout={documentLayout}
        allowLineItemDiscounts={allowLineItemDiscounts}
        allowTransactionDiscounts={allowTransactionDiscounts}
        taxCodeOptions={taxCodeOptions}
        tenantCountry={tenantCountry}
        preferredOriginLocationId={preferredOriginLocationId}
        documentConversionMode={documentConversionMode}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
        onOpenEdit={handleOpenEdit}
      />
    </>
  );
}
