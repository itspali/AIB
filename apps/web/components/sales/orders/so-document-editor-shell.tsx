"use client";

import { useMemo } from "react";
import {
  SalesCommerceEditorShell,
  SALES_COMMERCE_FULL_PAGE_LAYOUT,
} from "@/components/sales/shared/sales-commerce-editor-shell";
import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";
import { DEFAULT_SALES_ORDER_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import {
  computeSalesCommerceDraftTotals,
  type SalesCommerceTotalsOptions,
} from "@/lib/sales/orders/totals";
import {
  createEmptySoLine,
  filterSavableSoLines,
  type SoDraftFormState,
  type SoDraftLine,
} from "@/lib/sales/orders/draft-form";
import { resolveSalesGstContextFromForm } from "@/lib/sales/shared/sales-tax-supply";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";

export { SALES_COMMERCE_FULL_PAGE_LAYOUT as SO_FULL_PAGE_LAYOUT };

export type SoDocumentEditorShellProps = {
  form: SoDraftFormState;
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
  onPatch: (patch: Partial<SoDraftFormState>) => void;
  onLinesChange: (
    linesOrUpdater: SoDraftLine[] | ((current: SoDraftLine[]) => SoDraftLine[])
  ) => void;
};

export function SoDocumentEditorShell({
  form,
  locations,
  customers,
  defaultCurrency,
  documentLayout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  taxCodeOptions = [],
  tenantCountry = null,
  gstRegistered = false,
  isPending,
  layoutOverride = null,
  onPatch,
  onLinesChange,
}: SoDocumentEditorShellProps) {
  const gstContext = useMemo(
    () =>
      resolveSalesGstContextFromForm(
        customers,
        form.customer_id,
        locations,
        form.shipping_location_id,
        tenantCountry
      ),
    [customers, form.customer_id, form.shipping_location_id, locations, tenantCountry]
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
      originLocationId={form.shipping_location_id}
      locationField="shipping_location_id"
      lineFieldNames={{ quantity: "quantity_ordered", unitPrice: "unit_price_selling" }}
      requisitionField="customer_po_number"
      deliveryDateField="requested_ship_date"
      defaultCurrency={defaultCurrency}
      documentLayout={documentLayout}
      allowLineItemDiscounts={allowLineItemDiscounts}
      allowTransactionDiscounts={allowTransactionDiscounts}
      showCustomerCreditPanel
      taxCodeOptions={taxCodeOptions}
      tenantCountry={tenantCountry}
      gstRegistered={gstRegistered}
      isPending={isPending}
      layoutOverride={layoutOverride}
      createLine={createEmptySoLine}
      computeTotals={(lines) =>
        computeSalesCommerceDraftTotals(filterSavableSoLines(lines), totalsOptions)
      }
      onPatch={onPatch}
      onLinesChange={onLinesChange}
    />
  );
}
