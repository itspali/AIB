"use client";

import { useMemo } from "react";
import { PoDocumentSummaryStack } from "@/components/procurement/purchase-orders/po-document-summary-stack";
import { PoFormHeader } from "@/components/procurement/purchase-orders/po-form-header";
import { PoLineEntryAnchorToggle } from "@/components/procurement/purchase-orders/po-line-entry-anchor-toggle";
import { PoLineTaxModeToggle } from "@/components/procurement/purchase-orders/po-line-tax-mode-toggle";
import { PoLineEntryTable } from "@/components/procurement/purchase-orders/po-line-entry-table";
import { usePoLineEntryAnchor } from "@/components/procurement/purchase-orders/use-po-line-entry-anchor";
import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";
import { usePoDocumentLayout } from "@/lib/documents/use-po-document-layout";
import { getVisiblePoFormHeaderNotesField } from "@/lib/documents/po-form-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import {
  poSideRailBreakpointClass,
  resolvePoSideRailWidthClass,
} from "@/lib/procurement/purchase-orders/po-drawer-side-rail-layout";
import { usePoDrawerFormLayout } from "@/lib/procurement/purchase-orders/use-po-drawer-form-layout";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import {
  isOrganizationGstRegistered,
} from "@/lib/procurement/purchase-orders/po-gst-compliance";
import { resolvePoGstContextFromForm } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { PoAutoRoundOffPolicy } from "@/lib/procurement/purchase-orders/po-auto-round-off";
import { cn } from "@/lib/utils";

export const PO_FULL_PAGE_LAYOUT: RightDrawerLayoutValue = {
  widthVw: 100,
  isPartialDrawer: false,
};

const PO_SIDE_RAIL_SECTION_TITLE_CLASS =
  "shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

function poLinesTableSlotClass(fillHeight: boolean) {  return cn("min-h-0 min-w-0 max-w-full", fillHeight && "flex flex-1 flex-col");
}

export type PoDocumentEditorShellProps = {
  form: PoDraftFormState;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  editOrderId: string | null;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  allowTransactionDiscounts?: boolean;
  enableMrpTradeTerms?: boolean;
  promoDefaultCategory?: string;
  autoRoundOffPolicy?: PoAutoRoundOffPolicy;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  tenantCountry?: string | null;
  organizationBillTo?: OrganizationBillToSnapshot | null;
  isPending: boolean;
  layoutOverride?: RightDrawerLayoutValue | null;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
  onLinesChange: (
    linesOrUpdater:
      | PoDraftFormState["lines"]
      | ((current: PoDraftFormState["lines"]) => PoDraftFormState["lines"])
  ) => void;
};

export function PoDocumentEditorShell({
  form,
  locations,
  suppliers,
  editOrderId,
  defaultCurrency,
  documentLayout,
  allowLineItemDiscounts = false,
  allowTransactionDiscounts = false,
  enableMrpTradeTerms = true,
  promoDefaultCategory = "FREE_GOODS",
  autoRoundOffPolicy,
  taxCodeOptions = [],
  tenantCountry = null,
  organizationBillTo = null,
  isPending,
  layoutOverride = null,
  onPatch,
  onLinesChange,
}: PoDocumentEditorShellProps) {
  const resolvedDocumentLayout = usePoDocumentLayout(documentLayout);
  const showNotesSection = Boolean(getVisiblePoFormHeaderNotesField(resolvedDocumentLayout));
  const {
    drawerWidthVw,
    useFullPageLayout,
    useDesktopSideRail,
    useMobileDocumentStack,
    lineTableFillHeight,
  } = usePoDrawerFormLayout(true, layoutOverride);
  const { entryAnchor, handleEntryAnchorChange } = usePoLineEntryAnchor(form.lines, onLinesChange);
  const gstRegistered = useMemo(
    () => isOrganizationGstRegistered(organizationBillTo),
    [organizationBillTo]
  );
  const tenantCountryCode = organizationBillTo?.country_code ?? tenantCountry;
  const gstContext = useMemo(
    () =>
      resolvePoGstContextFromForm(
        suppliers,
        form.supplier_id,
        locations,
        form.destination_location_id,
        tenantCountryCode
      ),
    [suppliers, form.supplier_id, locations, form.destination_location_id, tenantCountryCode]
  );

  const sideRailWidthClass = resolvePoSideRailWidthClass(useFullPageLayout, drawerWidthVw);
  const sideRailDesktopShowClass = poSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "desktopShow"
  );
  const sideRailMobileHideClass = poSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "mobileHide"
  );
  const sideRailFlexRowClass = poSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "flexRow"
  );
  const sideRailHeightClass = poSideRailBreakpointClass(
    drawerWidthVw,
    useFullPageLayout,
    "sideRailHeight"
  );

  const linesSectionHeader = (
    <div className="flex shrink-0 items-center justify-between gap-2 sm:gap-3">
      <p className={cn(PO_SIDE_RAIL_SECTION_TITLE_CLASS, "shrink-0")}>Lines</p>
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1 sm:gap-2">
        <PoLineTaxModeToggle
          value={form.prices_tax_inclusive}
          disabled={isPending}
          onChange={(pricesTaxInclusive) => onPatch({ prices_tax_inclusive: pricesTaxInclusive })}
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
    <PoLineEntryTable
      fillHeight={lineTableFillHeight}
      showSectionTitle={false}
      lines={form.lines}
      supplierId={form.supplier_id}
      destinationLocationId={form.destination_location_id}
      excludePurchaseOrderId={editOrderId}
      disabled={isPending}
      layout={resolvedDocumentLayout}
      allowLineItemDiscounts={allowLineItemDiscounts}
      enableMrpTradeTerms={enableMrpTradeTerms}
      promoDefaultCategory={promoDefaultCategory}
      pricesTaxInclusive={form.prices_tax_inclusive}
      taxSupplyNature={gstContext.supplyNature}
      taxMechanism={gstContext.taxMechanism}
      taxCodeOptions={taxCodeOptions}
      gstRegistered={gstRegistered}
      entryAnchor={entryAnchor}
      onEntryAnchorChange={handleEntryAnchorChange}
      onChange={onLinesChange}
    />
  );

  const poFormHeader = (
    <PoFormHeader
      form={form}
      locations={locations}
      suppliers={suppliers}
      disabled={isPending}
      defaultCurrency={defaultCurrency}
      layout={resolvedDocumentLayout}
      onPatch={onPatch}
    />
  );

  const totalsPanelProps = {
    lines: form.lines,
    layout: resolvedDocumentLayout,
    layoutMode: "embedded" as const,
    density: "compact" as const,
    purchasePricesTaxInclusive: form.prices_tax_inclusive,
    taxMechanism: gstContext.taxMechanism,
    headerCharges: form.header_charges,
    autoRoundOffPolicy,
    disabled: isPending,
    allowTransactionDiscounts,
    onHeaderChargesChange: (patch: Partial<PoDraftFormState["header_charges"]>) =>
      onPatch({ header_charges: { ...form.header_charges, ...patch } }),
  };

  const detailsPanelProps = {
    form,
    disabled: isPending,
    density: "compact" as const,
    documentLayout: resolvedDocumentLayout,
    suppliers,
    locations,
    tenantCountry,
    onPatch,
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
    notesPanelProps,
  };

  const sideRail = (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden",
        sideRailWidthClass
      )}
    >
      <PoDocumentSummaryStack variant="rail" {...summaryStackProps} />
    </aside>
  );
  const leftDocumentColumn = (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 min-w-0">{poFormHeader}</div>
      {linesSectionHeader}
      <div className={poLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
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
      <div className="shrink-0 min-w-0">{poFormHeader}</div>
      <div className="flex min-w-0 flex-col gap-3">
        {linesSectionHeader}
        <div className={poLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
      </div>
      <PoDocumentSummaryStack
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
      <div className="shrink-0 w-full min-w-0">{poFormHeader}</div>
      <section className="flex w-full min-w-0 max-w-full flex-col gap-4">
        <div className="flex min-w-0 max-w-full flex-col gap-3">
          {linesSectionHeader}
          <div className={poLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
        </div>
      </section>
      <div className="flex w-full min-w-0 flex-col gap-4 border-t border-border pt-4">
        <PoDocumentSummaryStack
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
          <div
            className={cn(
              "min-h-0 flex-1 flex-col overflow-hidden",
              sideRailDesktopShowClass
            )}
          >
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
