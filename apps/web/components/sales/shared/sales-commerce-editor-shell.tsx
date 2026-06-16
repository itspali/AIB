"use client";

import { useMemo, type ComponentProps } from "react";
import { SalesCommerceFormHeader } from "@/components/sales/shared/sales-commerce-form-header";
import { SalesCommerceLineEntryTable } from "@/components/sales/shared/sales-commerce-line-entry-table";
import type { SalesCommerceLineFieldNames } from "@/components/sales/shared/sales-commerce-line-entry-table";
import { SalesCommerceNotesPanel } from "@/components/sales/shared/sales-commerce-notes-panel";
import { SalesCommerceSummaryStack } from "@/components/sales/shared/sales-commerce-summary-stack";
import { SalesCommerceAddressBlocks } from "@/components/sales/shared/sales-commerce-address-blocks";
import { SalesCustomerCreditPanel } from "@/components/sales/shared/sales-customer-credit-panel";
import { PoLineEntryAnchorToggle } from "@/components/procurement/purchase-orders/po-line-entry-anchor-toggle";
import { PoLineTaxModeToggle } from "@/components/procurement/purchase-orders/po-line-tax-mode-toggle";
import { useSalesLineEntryAnchor } from "@/components/sales/shared/use-sales-line-entry-actions";
import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";
import { useSalesDocumentLayout } from "@/lib/documents/use-sales-document-layout";
import { getVisibleSalesFormHeaderNotesField } from "@/lib/sales/shared/sales-form-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import {
  salesSideRailBreakpointClass,
  resolveSalesSideRailWidthClass,
  useSalesDrawerFormLayout,
} from "@/lib/sales/shared/sales-drawer-layout";
import { resolveSalesCommerceAddressBlocks } from "@/lib/sales/shared/resolve-sales-address-blocks";
import { resolveSalesGstContextFromForm } from "@/lib/sales/shared/sales-tax-supply";
import type { SalesHeaderChargesFields } from "@/lib/sales/shared/sales-header-charges";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import { useSalesLineCatalogHydration } from "@/components/sales/shared/use-sales-line-catalog-hydration";
import type {
  SalesCommerceDetailsCustomFields,
  SalesCommerceDetailsForm,
} from "@/components/sales/shared/sales-commerce-details-panel";
import type { SalesCommerceTotalsSnapshot } from "@/lib/sales/orders/totals";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";
import { syncSalesLineSellingMarkdownFromOfferPrice } from "@/lib/sales/shared/sales-line-selling-markdown";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { cn } from "@/lib/utils";

type NotesPanelProps = ComponentProps<typeof SalesCommerceNotesPanel>;

export const SALES_COMMERCE_FULL_PAGE_LAYOUT: RightDrawerLayoutValue = {
  widthVw: 100,
  isPartialDrawer: false,
};

const SALES_SIDE_RAIL_SECTION_TITLE_CLASS =
  "shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

function salesLinesTableSlotClass(fillHeight: boolean) {
  return cn("min-h-0 min-w-0 max-w-full", fillHeight && "flex flex-1 flex-col");
}

export type SalesCommerceDraftLineConstraint = SalesCommerceLineBase & {
  key: string;
  [field: string]: unknown;
};

export type SalesCommerceEditorFormBase = {
  customer_id: string;
  currency_code: string;
  payment_terms_days: string;
  prices_tax_inclusive: boolean;
  header_charges: SalesHeaderChargesFields;
  billing_state: string;
  shipping_state: string;
  custom_fields: SalesCommerceDetailsCustomFields & { internal_notes?: string };
  lines: SalesCommerceDraftLineConstraint[];
};

export type SalesCommerceEditorShellProps<
  TForm extends SalesCommerceEditorFormBase,
  TLine extends SalesCommerceDraftLineConstraint,
> = {
  form: TForm;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  originLocationId: string;
  locationField: "shipping_location_id" | "origin_location_id";
  lineFieldNames: SalesCommerceLineFieldNames;
  requisitionField?: keyof SalesCommerceDetailsCustomFields;
  deliveryDateField?: keyof SalesCommerceDetailsCustomFields;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  showCustomerCreditPanel?: boolean;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  tenantCountry?: string | null;
  isPending: boolean;
  layoutOverride?: RightDrawerLayoutValue | null;
  computeTotals: (lines: TLine[]) => SalesCommerceTotalsSnapshot;
  createLine: () => TLine;
  onPatch: (patch: Partial<TForm>) => void;
  onLinesChange: (linesOrUpdater: TLine[] | ((current: TLine[]) => TLine[])) => void;
};

export function SalesCommerceEditorShell<
  TForm extends SalesCommerceEditorFormBase,
  TLine extends SalesCommerceDraftLineConstraint,
>({
  form,
  locations,
  customers,
  originLocationId,
  locationField,
  lineFieldNames,
  requisitionField = "customer_po_number",
  deliveryDateField = "requested_ship_date",
  defaultCurrency,
  documentLayout,
  allowLineItemDiscounts = true,
  allowTransactionDiscounts = false,
  showCustomerCreditPanel = false,
  taxCodeOptions = [],
  tenantCountry = null,
  isPending,
  layoutOverride = null,
  computeTotals,
  createLine,
  onPatch,
  onLinesChange,
}: SalesCommerceEditorShellProps<TForm, TLine>) {
  const resolvedDocumentLayout = useSalesDocumentLayout(documentLayout);
  const showNotesSection = Boolean(getVisibleSalesFormHeaderNotesField(resolvedDocumentLayout));
  const {
    drawerWidthVw,
    useFullPageLayout,
    useDesktopSideRail,
    useMobileDocumentStack,
    lineTableFillHeight,
  } = useSalesDrawerFormLayout(true, layoutOverride);
  const { entryAnchor, handleEntryAnchorChange } = useSalesLineEntryAnchor(
    form.lines as TLine[],
    onLinesChange,
    { createLine }
  );

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.id === form.customer_id),
    [customers, form.customer_id]
  );
  const gstContext = useMemo(
    () =>
      resolveSalesGstContextFromForm(
        customers,
        form.customer_id,
        locations,
        originLocationId,
        tenantCountry
      ),
    [customers, form.customer_id, locations, originLocationId, tenantCountry]
  );
  useSalesLineCatalogHydration(
    form.lines as TLine[],
    onLinesChange,
    taxCodeOptions,
    form.prices_tax_inclusive
  );
  const addressBlocks = useMemo(
    () =>
      resolveSalesCommerceAddressBlocks({
        customer: selectedCustomer,
        billing_state: form.billing_state,
        shipping_state: form.shipping_state,
      }),
    [selectedCustomer, form.billing_state, form.shipping_state]
  );
  const draftTotals = useMemo(
    () => computeTotals(form.lines as TLine[]),
    [computeTotals, form.lines]
  );

  const addressAndCreditPanel =
    addressBlocks.length > 0 || showCustomerCreditPanel ? (
      <div className="flex shrink-0 flex-col gap-3">
        {addressBlocks.length > 0 ? (
          <SalesCommerceAddressBlocks blocks={addressBlocks} compact />
        ) : null}
        {showCustomerCreditPanel ? (
          <SalesCustomerCreditPanel
            customer={selectedCustomer}
            orderNetAmount={draftTotals.grandTotal}
          />
        ) : null}
      </div>
    ) : null;

  const sideRailWidthClass = resolveSalesSideRailWidthClass(useFullPageLayout, drawerWidthVw);
  const sideRailDesktopShowClass = salesSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "desktopShow"
  );
  const sideRailMobileHideClass = salesSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "mobileHide"
  );
  const sideRailFlexRowClass = salesSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "flexRow"
  );
  const sideRailHeightClass = salesSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "sideRailHeight"
  );

  const linesSectionHeader = (
    <div className="flex shrink-0 items-center justify-between gap-2 sm:gap-3">
      <p className={cn(SALES_SIDE_RAIL_SECTION_TITLE_CLASS, "shrink-0")}>Lines</p>
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1 sm:gap-2">
        <PoLineTaxModeToggle
          value={form.prices_tax_inclusive}
          disabled={isPending}
          onChange={(pricesTaxInclusive) => {
            onPatch({
              prices_tax_inclusive: pricesTaxInclusive,
              lines: (form.lines as TLine[]).map((line) => {
                const sync = syncSalesLineSellingMarkdownFromOfferPrice(line, pricesTaxInclusive);
                return sync ? ({ ...line, ...sync } as TLine) : line;
              }),
            } as unknown as Partial<TForm>);
          }}
        />
        <PoLineEntryAnchorToggle
          value={entryAnchor}
          disabled={isPending}
          onChange={handleEntryAnchorChange}
        />
      </div>
    </div>
  );

  const linesTable = (
    <SalesCommerceLineEntryTable
      fillHeight={lineTableFillHeight}
      showSectionTitle={false}
      lines={form.lines as unknown as (SalesCommerceLineBase & Record<string, string | null>)[]}
      fieldNames={lineFieldNames}
      disabled={isPending}
      layout={resolvedDocumentLayout}
      allowLineItemDiscounts={allowLineItemDiscounts}
      pricesTaxInclusive={form.prices_tax_inclusive}
      taxMechanism={gstContext.taxMechanism}
      taxCodeOptions={taxCodeOptions}
      entryAnchor={entryAnchor}
      onEntryAnchorChange={handleEntryAnchorChange}
      onChange={onLinesChange as (lines: (SalesCommerceLineBase & Record<string, string | null>)[] | ((current: (SalesCommerceLineBase & Record<string, string | null>)[]) => (SalesCommerceLineBase & Record<string, string | null>)[])) => void}
      createLine={createLine as () => SalesCommerceLineBase & Record<string, string | null>}
    />
  );

  const formHeader = (
    <SalesCommerceFormHeader
      form={form}
      locations={locations}
      customers={customers}
      locationId={originLocationId}
      locationField={locationField}
      disabled={isPending}
      defaultCurrency={defaultCurrency}
      layout={resolvedDocumentLayout}
      onPatch={onPatch}
    />
  );

  const totalsPanelProps = {
    lines: form.lines as TLine[],
    layout: resolvedDocumentLayout,
    layoutMode: "embedded" as const,
    density: "compact" as const,
    headerCharges: form.header_charges,
    allowTransactionDiscounts,
    disabled: isPending,
    computeTotals,
    onHeaderChargesChange: (patch: Partial<SalesHeaderChargesFields>) =>
      onPatch({ header_charges: { ...form.header_charges, ...patch } } as Partial<TForm>),
  };

  const detailsPanelProps = {
    form: form as SalesCommerceDetailsForm & { custom_fields: SalesCommerceDetailsCustomFields },
    originLocationId,
    requisitionField,
    deliveryDateField,
    disabled: isPending,
    density: "compact" as const,
    documentLayout: resolvedDocumentLayout,
    customers,
    locations,
    tenantCountry,
    onPatch: onPatch as (patch: Partial<SalesCommerceDetailsForm & { custom_fields: SalesCommerceDetailsCustomFields }>) => void,
  };

  const notesPanelProps = {
    form,
    disabled: isPending,
    documentLayout: resolvedDocumentLayout,
    onPatch,
  };

  const summaryStackProps = {
    showNotesSection,
    totalsPanelProps,
    detailsPanelProps: {
      ...detailsPanelProps,
      layout: "rail" as const,
    },
    notesPanelProps: {
      ...notesPanelProps,
      onPatch: onPatch as NotesPanelProps["onPatch"],
    },
  };

  const sideRail = (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden",
        sideRailWidthClass
      )}
    >
      <SalesCommerceSummaryStack variant="rail" {...summaryStackProps} />
    </aside>
  );

  const leftDocumentColumn = (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 min-w-0">{formHeader}</div>
      {addressAndCreditPanel}
      {linesSectionHeader}
      <div className={salesLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
    </div>
  );

  const desktopTwoColumnSection = (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden",
        sideRailFlexRowClass
      )}
    >
      {leftDocumentColumn}
      <div
        className={cn(
          "min-h-0 shrink-0 self-stretch",
          sideRailDesktopShowClass,
          sideRailHeightClass
        )}
      >
        {sideRail}
      </div>
    </section>
  );

  const mobileStackedLayout = (
    <div
      className={cn(
        "relative z-0 flex w-full min-w-0 shrink-0 flex-col gap-4 bg-background",
        useDesktopSideRail && sideRailMobileHideClass
      )}
    >
      <div className="shrink-0 min-w-0">{formHeader}</div>
      {addressAndCreditPanel}
      <div className="flex min-w-0 flex-col gap-3">
        {linesSectionHeader}
        <div className={salesLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
      </div>
      <SalesCommerceSummaryStack
        variant="flow"
        {...summaryStackProps}
        detailsPanelProps={{
          ...detailsPanelProps,
          layout: "stack",
        }}
      />
    </div>
  );

  const narrowDrawerStackedLayout = (
    <>
      <div className="shrink-0 w-full min-w-0">{formHeader}</div>
      {addressAndCreditPanel}
      <section className="flex w-full min-w-0 max-w-full flex-col gap-4">
        <div className="flex min-w-0 max-w-full flex-col gap-3">
          {linesSectionHeader}
          <div className={salesLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
        </div>
      </section>
      <div className="flex w-full min-w-0 flex-col gap-4 border-t border-border pt-4">
        <SalesCommerceSummaryStack
          variant="flow"
          {...summaryStackProps}
          detailsPanelProps={{
            ...detailsPanelProps,
            layout: "stack",
          }}
        />
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3",
        lineTableFillHeight && "h-full min-h-0 flex-1 overflow-hidden"
      )}
    >
      {useDesktopSideRail ? (
        <>
          <div className={cn("min-h-0 flex-1 flex-col overflow-hidden", sideRailDesktopShowClass)}>
            {desktopTwoColumnSection}
          </div>
          <div className={sideRailMobileHideClass}>{mobileStackedLayout}</div>
        </>
      ) : useMobileDocumentStack ? (
        mobileStackedLayout
      ) : (
        narrowDrawerStackedLayout
      )}
    </div>
  );
}
