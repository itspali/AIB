"use client";

import { PoDetailsPanel } from "@/components/procurement/purchase-orders/po-details-panel";
import { PoFormHeader } from "@/components/procurement/purchase-orders/po-form-header";
import { PoLineEntryAnchorToggle } from "@/components/procurement/purchase-orders/po-line-entry-anchor-toggle";
import { PoLineEntryTable } from "@/components/procurement/purchase-orders/po-line-entry-table";
import { usePoLineEntryAnchor } from "@/components/procurement/purchase-orders/use-po-line-entry-anchor";
import { PoTotalsPanel } from "@/components/procurement/purchase-orders/po-totals-panel";
import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";
import { usePoDocumentLayout } from "@/lib/documents/use-po-document-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import { usePoDrawerFormLayout } from "@/lib/procurement/purchase-orders/use-po-drawer-form-layout";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { cn } from "@/lib/utils";

export const PO_FULL_PAGE_LAYOUT: RightDrawerLayoutValue = {
  widthVw: 100,
  isPartialDrawer: false,
};

function poLinesTableSlotClass(fillHeight: boolean) {
  return cn("min-h-0 min-w-0 max-w-full", fillHeight && "flex flex-1 flex-col");
}

export type PoDocumentEditorShellProps = {
  form: PoDraftFormState;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  editOrderId: string | null;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  purchasePricesTaxInclusive?: boolean;
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
  purchasePricesTaxInclusive = false,
  isPending,
  layoutOverride = null,
  onPatch,
  onLinesChange,
}: PoDocumentEditorShellProps) {
  const resolvedDocumentLayout = usePoDocumentLayout(documentLayout);
  const { useWidePartialDrawer, useFullPageLayout, lineTableFillHeight } =
    usePoDrawerFormLayout(true, layoutOverride);
  const { entryAnchor, handleEntryAnchorChange } = usePoLineEntryAnchor(form.lines, onLinesChange);

  const linesSectionHeader = (
    <div className="flex shrink-0 items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lines</p>
      <PoLineEntryAnchorToggle
        value={entryAnchor}
        disabled={isPending}
        onChange={handleEntryAnchorChange}
      />
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
      entryAnchor={entryAnchor}
      onEntryAnchorChange={handleEntryAnchorChange}
      onChange={onLinesChange}
    />
  );

  const stackedSummaryDetails = (
    <>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <PoTotalsPanel
          lines={form.lines}
          layout={resolvedDocumentLayout}
          layoutMode="embedded"
          purchasePricesTaxInclusive={purchasePricesTaxInclusive}
        />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </p>
        <PoDetailsPanel
          form={form}
          disabled={isPending}
          layout="stack"
          documentLayout={resolvedDocumentLayout}
          onPatch={onPatch}
        />
      </div>
    </>
  );

  const sideRail = (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:h-full lg:min-h-0 lg:w-[15rem] lg:max-h-full lg:max-w-[40%] lg:shrink-0 lg:overflow-hidden">
      <div className="shrink-0 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <PoTotalsPanel
          lines={form.lines}
          layout={resolvedDocumentLayout}
          layoutMode="embedded"
          purchasePricesTaxInclusive={purchasePricesTaxInclusive}
        />
      </div>
      <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </p>
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <PoDetailsPanel
            form={form}
            disabled={isPending}
            layout="rail"
            documentLayout={resolvedDocumentLayout}
            onPatch={onPatch}
          />
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3",
        lineTableFillHeight && "h-full min-h-0 flex-1 overflow-hidden"
      )}
    >
      <div className="shrink-0 w-full min-w-0">
        <PoFormHeader
          form={form}
          locations={locations}
          suppliers={suppliers}
          disabled={isPending}
          defaultCurrency={defaultCurrency}
          layout={resolvedDocumentLayout}
          onPatch={onPatch}
        />
      </div>

      {useWidePartialDrawer ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden lg:min-w-0">
            {linesSectionHeader}
            <div className={poLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
          </div>
          {sideRail}
        </section>
      ) : useFullPageLayout ? (
        <>
          <section
            className={cn(
              "flex w-full min-w-0 max-w-full flex-col gap-3",
              lineTableFillHeight && "min-h-0 flex-1 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4"
            )}
          >
            <div
              className={cn(
                "flex min-w-0 max-w-full flex-col gap-3",
                lineTableFillHeight && "min-h-0 flex-1 overflow-hidden lg:min-w-0"
              )}
            >
              {linesSectionHeader}
              <div className={poLinesTableSlotClass(lineTableFillHeight)}>{linesTable}</div>
            </div>
            <div className="hidden lg:flex lg:min-h-0">{sideRail}</div>
          </section>
          <div className="relative z-0 flex w-full min-w-0 shrink-0 flex-col gap-4 bg-background lg:hidden">
            {stackedSummaryDetails}
          </div>
        </>
      ) : lineTableFillHeight ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(12rem,1fr)_auto] gap-3 overflow-hidden">
          <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
            {linesSectionHeader}
            <div className={poLinesTableSlotClass(true)}>{linesTable}</div>
          </section>
          <div className="max-h-[min(40vh,16rem)] min-h-0 overflow-y-auto border-t border-border pt-4">
            {stackedSummaryDetails}
          </div>
        </div>
      ) : (
        <>
          <section className="flex w-full min-w-0 max-w-full flex-col gap-4">
            <div className="flex min-w-0 max-w-full flex-col gap-3">
              {linesSectionHeader}
              <div className={poLinesTableSlotClass(false)}>{linesTable}</div>
            </div>
          </section>
          <div className="flex w-full min-w-0 flex-col gap-4 border-t border-border pt-4">
            {stackedSummaryDetails}
          </div>
        </>
      )}
    </div>
  );
}
