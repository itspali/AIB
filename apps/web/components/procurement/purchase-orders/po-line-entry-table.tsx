"use client";

import { useEffect, useMemo } from "react";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getItemDetailLineFields,
  getPoLayoutColumnPref,
  getPoLineEntryTableColumns,
  normalizePoLayoutTemplate,
  PO_LINE_IMAGE_COLUMN_ID,
  resolvePoLineImageDisplayMode,
} from "@/lib/documents/purchase-order-layout";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import { shouldShowPoDiscountAmountUnderPctColumn } from "@/lib/procurement/purchase-orders/po-line-discount";
import { shouldShowPoTaxRateUnderLineTaxColumn } from "@/lib/procurement/purchase-orders/po-line-tax";
import { shouldShowPoUnitUnderQtyColumn } from "@/lib/procurement/purchase-orders/po-line-unit";
import {
  computeDocumentLineMinTableWidth,
  getDocumentLineColumnMinWidthRem,
  getDocumentLineColumnWidthClass,
  getDocumentLineColumnWidthRem,
} from "@/lib/documents/line-column-widths";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PoLineEntryAnchor } from "@/lib/procurement/purchase-orders/line-entry-anchor";
import {
  resolvePoLineTotalColumnLabel,
  resolvePoUnitPriceColumnLabel,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { PoLineEntryAnchorToggle } from "@/components/procurement/purchase-orders/po-line-entry-anchor-toggle";
import { PoLineTaxModeToggle } from "@/components/procurement/purchase-orders/po-line-tax-mode-toggle";
import { usePoLineEntryAnchor } from "@/components/procurement/purchase-orders/use-po-line-entry-anchor";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";
import {
  canReorderPoDraftLine,
  usePoLineEntryActions,
} from "@/components/procurement/purchase-orders/po-line-entry-actions";
import { usePoLineCatalogHydration } from "@/components/procurement/purchase-orders/use-po-line-catalog-hydration";
import {
  type LineCellContext,
  renderPoLineColumnCell,
} from "@/components/procurement/purchase-orders/po-line-entry-cells";
import {
  DocumentLineEntryGrid,
  DocumentLineEntrySection,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";

type Props = {
  lines: PoDraftLine[];
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  disabled?: boolean;
  showSectionTitle?: boolean;
  /** Fill parent height and scroll line rows inside the table panel. */
  fillHeight?: boolean;
  layout?: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  enableMrpTradeTerms?: boolean;
  pricesTaxInclusive?: boolean;
  taxSupplyNature?: PoTaxSupplyNature;
  taxMechanism?: GstTaxMechanism;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  onPricesTaxInclusiveChange?: (value: boolean) => void;
  entryAnchor?: PoLineEntryAnchor;
  onEntryAnchorChange?: (anchor: PoLineEntryAnchor) => void;
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void;
};

const PO_LINE_EDITABLE_COLUMN_IDS = new Set<string>([
  "item",
  "quantity_ordered",
  "unit_price",
  "discount_pct",
]);

function PoLineEntryGrid({
  lines,
  supplierId,
  destinationLocationId,
  excludePurchaseOrderId,
  disabled,
  fillHeight,
  layout: layoutProp,
  allowLineItemDiscounts,
  enableMrpTradeTerms,
  pricesTaxInclusive = false,
  taxSupplyNature = "INTERSTATE",
  taxMechanism = "FORWARD",
  taxCodeOptions = [],
  actions,
}: {
  lines: PoDraftLine[];
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  disabled: boolean;
  fillHeight: boolean;
  layout: DocumentLayoutTemplate;
  allowLineItemDiscounts: boolean;
  enableMrpTradeTerms: boolean;
  pricesTaxInclusive: boolean;
  taxSupplyNature: PoTaxSupplyNature;
  taxMechanism: GstTaxMechanism;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  actions: ReturnType<typeof usePoLineEntryActions>;
}) {
  const layout = useMemo(() => normalizePoLayoutTemplate(layoutProp), [layoutProp]);
  const imageDisplayMode = useMemo(() => resolvePoLineImageDisplayMode(layout), [layout]);
  const visibleColumns = useMemo(
    () => getPoLineEntryTableColumns(layout, { allowLineItemDiscounts }),
    [layout, allowLineItemDiscounts]
  );
  const nestedColumns = useMemo(() => getItemDetailLineFields(layout), [layout]);
  const showUnitUnderQty = useMemo(() => shouldShowPoUnitUnderQtyColumn(layout), [layout]);
  const discountAmountColumn = useMemo(
    () => getPoLayoutColumnPref(layout, "discount_amount"),
    [layout]
  );
  const taxRateColumn = useMemo(() => getPoLayoutColumnPref(layout, "tax_rate_pct"), [layout]);
  const showTaxRateUnderLineTax = useMemo(
    () => shouldShowPoTaxRateUnderLineTaxColumn(layout),
    [layout]
  );
  const showDiscountAmountUnderPct = useMemo(
    () => shouldShowPoDiscountAmountUnderPctColumn(layout),
    [layout]
  );
  const mrpColumnVisible = useMemo(
    () => visibleColumns.some((column) => column.id === "mrp"),
    [visibleColumns]
  );

  const columns: DocumentLineColumn[] = useMemo(
    () =>
      visibleColumns.map((column) => {
        let label = column.id === PO_LINE_IMAGE_COLUMN_ID ? "" : column.label;
        if (column.id === "unit_price") {
          label = resolvePoUnitPriceColumnLabel(pricesTaxInclusive);
        } else if (column.id === "line_total") {
          label = resolvePoLineTotalColumnLabel(pricesTaxInclusive);
        }

        return {
          id: column.id,
          label,
          align: column.align,
          widthClass: getDocumentLineColumnWidthClass(column.id),
          colWidthRem: getDocumentLineColumnWidthRem(column.id),
          colMinWidthRem: getDocumentLineColumnMinWidthRem(column.id),
          editable: PO_LINE_EDITABLE_COLUMN_IDS.has(column.id),
          headerClassName:
            column.id === PO_LINE_IMAGE_COLUMN_ID ? "w-[3.25rem] px-0" : undefined,
        };
      }),
    [visibleColumns, pricesTaxInclusive]
  );

  const minTableWidth = useMemo(
    () => computeDocumentLineMinTableWidth(visibleColumns.map((column) => column.id)),
    [visibleColumns]
  );

  return (
    <DocumentLineEntryGrid
      lines={lines}
      columns={columns}
      minTableWidth={minTableWidth}
      fillHeight={fillHeight}
      disabled={disabled}
      canRemoveLine={(_, __, allLines) => allLines.length > 1}
      onRemoveLine={actions.removeLine}
      canDuplicateLine={(line) => Boolean(line.variant_id)}
      onDuplicateLine={actions.duplicateLine}
      canReorderLine={(line) => canReorderPoDraftLine(line)}
      onReorderLine={actions.reorderLine}
      renderCell={(column, line) => {
        const layoutColumn = visibleColumns.find((entry) => entry.id === column.id);
        if (!layoutColumn) return null;

        const ctx: LineCellContext = {
          line,
          disabled,
          supplierId,
          destinationLocationId,
          excludePurchaseOrderId,
          enableMrpTradeTerms,
          mrpColumnVisible,
          pricesTaxInclusive,
          taxSupplyNature,
          taxMechanism,
          itemRefs: actions.itemRefs,
          qtyRefs: actions.qtyRefs,
          priceRefs: actions.priceRefs,
          patchLine: actions.patchLine,
          bindItemChange: actions.bindItemChange,
          focusPrice: actions.focusPrice,
          advanceFromLine: actions.advanceFromLine,
        };

        return renderPoLineColumnCell(column.id, layoutColumn, ctx, nestedColumns, imageDisplayMode, {
          showUnitUnderQty,
          discountAmountColumn,
          showTaxRateUnderLineTax,
          taxRateColumn,
          showDiscountAmountUnderPct,
          taxCodeOptions,
        });
      }}
    />
  );
}

export function PoLineEntryTable({
  lines,
  supplierId,
  destinationLocationId,
  excludePurchaseOrderId,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  layout = DEFAULT_PO_SCREEN_LAYOUT,
  allowLineItemDiscounts = false,
  enableMrpTradeTerms = true,
  pricesTaxInclusive = false,
  taxSupplyNature = "INTERSTATE",
  taxMechanism = "FORWARD",
  taxCodeOptions = [],
  onPricesTaxInclusiveChange,
  entryAnchor: entryAnchorProp,
  onEntryAnchorChange,
  onChange,
}: Props) {
  const resolvedLayout = useMemo(() => normalizePoLayoutTemplate(layout), [layout]);
  const isAnchorControlled = entryAnchorProp !== undefined;
  const internalAnchor = usePoLineEntryAnchor(lines, onChange, {
    enabled: !isAnchorControlled,
  });
  const entryAnchor = entryAnchorProp ?? internalAnchor.entryAnchor;
  const handleEntryAnchorChange =
    onEntryAnchorChange ?? internalAnchor.handleEntryAnchorChange;
  const actions = usePoLineEntryActions(lines, supplierId, onChange, entryAnchor);
  usePoLineCatalogHydration(lines, onChange);

  useEffect(() => {
    prefetchBrowseVariants();
  }, []);

  const anchorToggle = (
    <PoLineEntryAnchorToggle
      value={entryAnchor}
      disabled={disabled}
      onChange={handleEntryAnchorChange}
    />
  );

  const taxModeToggle =
    onPricesTaxInclusiveChange != null ? (
      <PoLineTaxModeToggle
        value={pricesTaxInclusive}
        disabled={disabled}
        onChange={onPricesTaxInclusiveChange}
      />
    ) : null;

  const headerControls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {taxModeToggle}
      {anchorToggle}
    </div>
  );

  return (
    <DocumentLineEntrySection
      title="Lines"
      fillHeight={fillHeight}
      showSectionTitle={showSectionTitle}
      headerAction={showSectionTitle ? headerControls : null}
    >
      <PoLineEntryGrid
        lines={lines}
        supplierId={supplierId}
        destinationLocationId={destinationLocationId}
        excludePurchaseOrderId={excludePurchaseOrderId}
        disabled={disabled}
        fillHeight={fillHeight}
        layout={resolvedLayout}
        allowLineItemDiscounts={allowLineItemDiscounts}
        enableMrpTradeTerms={enableMrpTradeTerms}
        pricesTaxInclusive={pricesTaxInclusive}
        taxSupplyNature={taxSupplyNature}
        taxMechanism={taxMechanism}
        taxCodeOptions={taxCodeOptions}
        actions={actions}
      />
    </DocumentLineEntrySection>
  );
}
