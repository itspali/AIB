"use client";

import { useMemo } from "react";
import {
  SalesCommerceEditorShell,
  SALES_COMMERCE_FULL_PAGE_LAYOUT,
} from "@/components/sales/shared/sales-commerce-editor-shell";
import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";
import { DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import {
  computeSalesCommerceDraftTotals,
  type SalesCommerceTotalsOptions,
} from "@/lib/sales/orders/totals";
import {
  createEmptyQuoteLine,
  filterSavableQuoteLines,
  type QuoteDraftFormState,
  type QuoteDraftLine,
} from "@/lib/sales/quotes/draft-form";
import { resolveSalesGstContextFromForm } from "@/lib/sales/shared/sales-tax-supply";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

export { SALES_COMMERCE_FULL_PAGE_LAYOUT as QUOTE_FULL_PAGE_LAYOUT };

export type QuoteDocumentEditorShellProps = {
  form: QuoteDraftFormState;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  defaultCurrency: string;
  documentLayout?: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  tenantCountry?: string | null;
  gstRegistered?: boolean;
  isPending: boolean;
  layoutOverride?: RightDrawerLayoutValue | null;
  onPatch: (patch: Partial<QuoteDraftFormState>) => void;
  onLinesChange: (
    linesOrUpdater: QuoteDraftLine[] | ((current: QuoteDraftLine[]) => QuoteDraftLine[])
  ) => void;
};

export function QuoteDocumentEditorShell({
  form,
  locations,
  customers,
  defaultCurrency,
  documentLayout = DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  taxCodeOptions = [],
  tenantCountry = null,
  gstRegistered = false,
  isPending,
  layoutOverride = null,
  onPatch,
  onLinesChange,
}: QuoteDocumentEditorShellProps) {
  const gstContext = useMemo(
    () =>
      resolveSalesGstContextFromForm(
        customers,
        form.customer_id,
        locations,
        form.origin_location_id,
        tenantCountry
      ),
    [customers, form.customer_id, form.origin_location_id, locations, tenantCountry]
  );

  const totalsOptions: SalesCommerceTotalsOptions = {
    sellingPricesTaxInclusive: form.prices_tax_inclusive,
    headerCharges: form.header_charges,
    allowTransactionDiscounts,
    taxMechanism: gstContext.taxMechanism,
  };

  return (
    <SalesCommerceEditorShell
      form={form}
      locations={locations}
      customers={customers}
      originLocationId={form.origin_location_id}
      locationField="origin_location_id"
      lineFieldNames={{ quantity: "quantity_quoted", unitPrice: "unit_price_selling" }}
      requisitionField="customer_reference"
      deliveryDateField="requested_ship_date"
      defaultCurrency={defaultCurrency}
      documentLayout={documentLayout}
      allowLineItemDiscounts={allowLineItemDiscounts}
      allowTransactionDiscounts={allowTransactionDiscounts}
      taxCodeOptions={taxCodeOptions}
      tenantCountry={tenantCountry}
      gstRegistered={gstRegistered}
      isPending={isPending}
      layoutOverride={layoutOverride}
      createLine={createEmptyQuoteLine}
      computeTotals={(lines) =>
        computeSalesCommerceDraftTotals(filterSavableQuoteLines(lines), totalsOptions)
      }
      onPatch={onPatch}
      onLinesChange={onLinesChange}
    />
  );
}
