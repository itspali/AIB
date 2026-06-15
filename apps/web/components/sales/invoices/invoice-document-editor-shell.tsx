"use client";

import { useMemo } from "react";
import {
  SalesCommerceEditorShell,
  SALES_COMMERCE_FULL_PAGE_LAYOUT,
} from "@/components/sales/shared/sales-commerce-editor-shell";
import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";
import { DEFAULT_SALES_INVOICE_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import {
  computeSalesCommerceDraftTotals,
  type SalesCommerceTotalsOptions,
} from "@/lib/sales/orders/totals";
import {
  createEmptyInvoiceLine,
  filterSavableInvoiceLines,
  type InvoiceDraftFormState,
  type InvoiceDraftLine,
} from "@/lib/sales/invoices/draft-form";
import { resolveSalesGstContextFromForm } from "@/lib/sales/shared/sales-tax-supply";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

export { SALES_COMMERCE_FULL_PAGE_LAYOUT as INVOICE_FULL_PAGE_LAYOUT };

export type InvoiceDocumentEditorShellProps = {
  form: InvoiceDraftFormState;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  defaultCurrency: string;
  documentLayout?: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  tenantCountry?: string | null;
  isPending: boolean;
  layoutOverride?: RightDrawerLayoutValue | null;
  onPatch: (patch: Partial<InvoiceDraftFormState>) => void;
  onLinesChange: (
    linesOrUpdater: InvoiceDraftLine[] | ((current: InvoiceDraftLine[]) => InvoiceDraftLine[])
  ) => void;
};

export function InvoiceDocumentEditorShell({
  form,
  locations,
  customers,
  defaultCurrency,
  documentLayout = DEFAULT_SALES_INVOICE_SCREEN_LAYOUT,
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  taxCodeOptions = [],
  tenantCountry = null,
  isPending,
  layoutOverride = null,
  onPatch,
  onLinesChange,
}: InvoiceDocumentEditorShellProps) {
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
      lineFieldNames={{ quantity: "quantity_invoiced", unitPrice: "unit_price_selling" }}
      requisitionField="customer_po_number"
      deliveryDateField="requested_ship_date"
      defaultCurrency={defaultCurrency}
      documentLayout={documentLayout}
      allowLineItemDiscounts={allowLineItemDiscounts}
      allowTransactionDiscounts={allowTransactionDiscounts}
      taxCodeOptions={taxCodeOptions}
      tenantCountry={tenantCountry}
      isPending={isPending}
      layoutOverride={layoutOverride}
      createLine={createEmptyInvoiceLine}
      computeTotals={(lines) =>
        computeSalesCommerceDraftTotals(filterSavableInvoiceLines(lines), totalsOptions)
      }
      onPatch={onPatch}
      onLinesChange={onLinesChange}
    />
  );
}
