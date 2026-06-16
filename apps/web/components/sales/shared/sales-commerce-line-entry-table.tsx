"use client";

import { useEffect, useMemo } from "react";
import { PoLineEntryAnchorToggle } from "@/components/procurement/purchase-orders/po-line-entry-anchor-toggle";
import { PoLineTaxModeToggle } from "@/components/procurement/purchase-orders/po-line-tax-mode-toggle";
import {
  DocumentLineEntryGrid,
  DocumentLineEntrySection,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";
import {
  computeDocumentLineMinTableWidth,
  getDocumentLineColumnMinWidthRem,
  getDocumentLineColumnWidthClass,
  getDocumentLineColumnWidthRem,
} from "@/lib/documents/line-column-widths";
import { applyGstRegisteredDocumentLayoutOverrides } from "@/lib/documents/gst-document-layout-compliance";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import { resolvePoUnitPriceColumnLabelFromLayout } from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";
import {
  createSalesCatalogFieldPref,
  DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  getSalesItemDetailLineFields,
  getSalesLayoutColumnPref,
  getSalesLineEntryTableColumns,
  normalizeSalesCommerceLayoutTemplate,
  resolveSalesLineImageDisplayMode,
  SALES_LINE_IMAGE_COLUMN_ID,
} from "@/lib/sales/shared/sales-commerce-layout";
import {
  shouldEmbedSalesTaxRateUnderLineTaxFromGrid,
  shouldShowSalesDiscountAmountUnderPctColumn,
  shouldShowSalesUnitUnderQtyColumn,
} from "@/lib/sales/shared/sales-line-display";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import {
  renderSalesLineColumnCell,
  type SalesLineCellContext,
} from "@/components/sales/shared/sales-line-entry-cells";
import { useLineStockContext } from "@/lib/inventory/stock/use-line-stock-context";
import {
  canDuplicateSalesCommerceLine,
  canRemoveSalesCommerceLine,
  canReorderSalesCommerceLine,
  useSalesLineEntryActions,
  useSalesLineEntryAnchor,
} from "@/components/sales/shared/use-sales-line-entry-actions";

export type SalesCommerceLineFieldNames = {
  quantity: "quantity_ordered" | "quantity_quoted" | "quantity_invoiced";
  unitPrice: "unit_price_selling";
};

type LineWithQuantity = SalesCommerceLineBase & Record<string, string | null>;

type Props<TLine extends LineWithQuantity> = {
  lines: TLine[];
  fieldNames: SalesCommerceLineFieldNames;
  disabled?: boolean;
  showSectionTitle?: boolean;
  fillHeight?: boolean;
  layout?: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  pricesTaxInclusive?: boolean;
  taxMechanism?: GstTaxMechanism;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  gstRegistered?: boolean;
  entryAnchor?: "top" | "bottom";
  onEntryAnchorChange?: (anchor: "top" | "bottom") => void;
  onPricesTaxInclusiveChange?: (value: boolean) => void;
  /** Stock-holding location for on-hand hints under item cells (ship-from / origin). */
  stockLocationId?: string;
  onChange: (lines: TLine[] | ((current: TLine[]) => TLine[])) => void;
  createLine: () => TLine;
};

const SALES_LINE_EDITABLE_COLUMN_IDS = new Set<string>([
  "item",
  "quantity_ordered",
  "unit_price",
  "discount_pct",
]);

function getLineQuantity<TLine extends LineWithQuantity>(line: TLine, field: string): string {
  return line[field] ?? "";
}

function setLineQuantity<TLine extends LineWithQuantity>(
  line: TLine,
  field: string,
  value: string
): TLine {
  return { ...line, [field]: value };
}

function SalesLineEntryGrid<TLine extends LineWithQuantity>({
  lines,
  fieldNames,
  disabled,
  fillHeight,
  autoScrollAddedLines,
  layout,
  allowLineItemDiscounts,
  pricesTaxInclusive,
  taxMechanism = "FORWARD",
  taxCodeOptions = [],
  gstRegistered = false,
  actions,
  getQuantity,
  stockLocationId = "",
}: {
  lines: TLine[];
  fieldNames: SalesCommerceLineFieldNames;
  disabled: boolean;
  fillHeight: boolean;
  autoScrollAddedLines?: "top" | "bottom";
  layout: DocumentLayoutTemplate;
  allowLineItemDiscounts: boolean;
  pricesTaxInclusive: boolean;
  taxMechanism: GstTaxMechanism;
  taxCodeOptions: readonly PoLineTaxCodeOption[];
  gstRegistered?: boolean;
  actions: ReturnType<typeof useSalesLineEntryActions<TLine>>;
  getQuantity: (line: TLine) => string;
  stockLocationId?: string;
}) {
  const resolvedLayout = useMemo(() => {
    const normalized = normalizeSalesCommerceLayoutTemplate(layout);
    return gstRegistered
      ? applyGstRegisteredDocumentLayoutOverrides(
          normalized,
          true,
          createSalesCatalogFieldPref
        )
      : normalized;
  }, [layout, gstRegistered]);
  const imageDisplayMode = useMemo(
    () => resolveSalesLineImageDisplayMode(resolvedLayout),
    [resolvedLayout]
  );
  const visibleColumns = useMemo(
    () => getSalesLineEntryTableColumns(resolvedLayout, { allowLineItemDiscounts }),
    [resolvedLayout, allowLineItemDiscounts]
  );
  const nestedColumns = useMemo(
    () => getSalesItemDetailLineFields(resolvedLayout),
    [resolvedLayout]
  );
  const showUnitUnderQty = useMemo(
    () => shouldShowSalesUnitUnderQtyColumn(resolvedLayout),
    [resolvedLayout]
  );
  const discountAmountColumn = useMemo(
    () => getSalesLayoutColumnPref(resolvedLayout, "discount_amount"),
    [resolvedLayout]
  );
  const showDiscountAmountUnderPct = useMemo(
    () => shouldShowSalesDiscountAmountUnderPctColumn(resolvedLayout),
    [resolvedLayout]
  );
  const taxRateColumn = useMemo(
    () => getSalesLayoutColumnPref(resolvedLayout, "tax_rate_pct"),
    [resolvedLayout]
  );
  const showTaxRateUnderLineTax = useMemo(
    () => shouldEmbedSalesTaxRateUnderLineTaxFromGrid(visibleColumns),
    [visibleColumns]
  );
  const lineVariantIds = useMemo(
    () => lines.map((line) => line.variant_id).filter(Boolean),
    [lines]
  );
  const getLineStockContext = useLineStockContext(stockLocationId, lineVariantIds);

  const columns: DocumentLineColumn[] = useMemo(
    () =>
      visibleColumns.map((column) => {
        let label = column.id === SALES_LINE_IMAGE_COLUMN_ID ? "" : column.label;
        if (column.id === "unit_price") {
          label = resolvePoUnitPriceColumnLabelFromLayout(column.label, pricesTaxInclusive);
        }

        return {
          id: column.id,
          label,
          align: column.align,
          widthClass: getDocumentLineColumnWidthClass(column.id),
          colWidthRem: getDocumentLineColumnWidthRem(column.id),
          colMinWidthRem: getDocumentLineColumnMinWidthRem(column.id),
          editable: SALES_LINE_EDITABLE_COLUMN_IDS.has(column.id),
          headerClassName:
            column.id === SALES_LINE_IMAGE_COLUMN_ID ? "w-[3.25rem] px-0" : undefined,
        };
      }),
    [visibleColumns, pricesTaxInclusive]
  );

  const minTableWidth = useMemo(
    () => computeDocumentLineMinTableWidth(visibleColumns.map((column) => column.id)),
    [visibleColumns]
  );

  const sharedCellContext = {
    quantityField: fieldNames.quantity,
    unitPriceField: fieldNames.unitPrice,
    disabled,
    pricesTaxInclusive,
    taxMechanism,
    itemRefs: actions.itemRefs,
    qtyRefs: actions.qtyRefs,
    priceRefs: actions.priceRefs,
    patchLine: actions.patchLine,
    bindItemChange: actions.bindItemChange,
    focusPrice: actions.focusPrice,
    advanceFromLine: actions.advanceFromLine,
    getQuantity,
    gstRegistered,
    getLineStockContext,
    stockLocationId,
  } satisfies Omit<SalesLineCellContext<TLine>, "line">;

  return (
    <DocumentLineEntryGrid
      lines={lines}
      columns={columns}
      minTableWidth={minTableWidth}
      fillHeight={fillHeight}
      autoScrollAddedLines={autoScrollAddedLines}
      disabled={disabled}
      canRemoveLine={(line, _, allLines) =>
        canRemoveSalesCommerceLine(line, allLines, getQuantity)
      }
      onRemoveLine={actions.removeLine}
      canDuplicateLine={(line) => canDuplicateSalesCommerceLine(line)}
      onDuplicateLine={actions.duplicateLine}
      canReorderLine={(line) => canReorderSalesCommerceLine(line)}
      onReorderLine={(fromKey, toKey, position) => actions.reorderLine(fromKey, toKey, position)}
      renderCell={(column, line) => {
        const layoutColumn = visibleColumns.find((entry) => entry.id === column.id);
        if (!layoutColumn) return null;

        return renderSalesLineColumnCell(
          column.id,
          layoutColumn,
          { ...sharedCellContext, line },
          nestedColumns,
          imageDisplayMode,
          {
            showUnitUnderQty,
            discountAmountColumn,
            showDiscountAmountUnderPct,
            taxRateColumn,
            showTaxRateUnderLineTax,
            taxCodeOptions,
          }
        );
      }}
    />
  );
}

export function SalesCommerceLineEntryTable<TLine extends LineWithQuantity>({
  lines,
  fieldNames,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  layout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  allowLineItemDiscounts = true,
  pricesTaxInclusive = false,
  taxMechanism = "FORWARD",
  taxCodeOptions = [],
  gstRegistered = false,
  entryAnchor: entryAnchorProp,
  onEntryAnchorChange,
  onPricesTaxInclusiveChange,
  stockLocationId = "",
  onChange,
  createLine,
}: Props<TLine>) {
  const resolvedLayout = useMemo(() => normalizeSalesCommerceLayoutTemplate(layout), [layout]);
  const quantityField = fieldNames.quantity;

  const isAnchorControlled = entryAnchorProp !== undefined;
  const internalAnchor = useSalesLineEntryAnchor(lines, onChange, {
    enabled: !isAnchorControlled,
    createLine,
  });
  const entryAnchor = entryAnchorProp ?? internalAnchor.entryAnchor;
  const handleEntryAnchorChange = onEntryAnchorChange ?? internalAnchor.handleEntryAnchorChange;

  const actions = useSalesLineEntryActions(lines, onChange, entryAnchor, {
    createLine,
    getQuantity: (line) => getLineQuantity(line, quantityField),
    setQuantity: (line, value) => setLineQuantity(line, quantityField, value),
    duplicateLine: (line) => ({ ...line, key: crypto.randomUUID() }),
    pricesTaxInclusive,
    stockLocationId,
  });

  useEffect(() => {
    prefetchBrowseVariants();
  }, []);

  const headerControls = (
    <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1 sm:gap-2">
      {onPricesTaxInclusiveChange ? (
        <PoLineTaxModeToggle
          value={pricesTaxInclusive}
          disabled={disabled}
          onChange={onPricesTaxInclusiveChange}
        />
      ) : null}
      <PoLineEntryAnchorToggle
        value={entryAnchor}
        disabled={disabled}
        onChange={handleEntryAnchorChange}
      />
    </div>
  );

  const grid = (
    <SalesLineEntryGrid
      lines={lines}
      fieldNames={fieldNames}
      disabled={disabled}
      fillHeight={fillHeight}
      autoScrollAddedLines={entryAnchor === "top" ? "top" : "bottom"}
      layout={resolvedLayout}
      allowLineItemDiscounts={allowLineItemDiscounts}
      pricesTaxInclusive={pricesTaxInclusive}
      taxMechanism={taxMechanism}
      taxCodeOptions={taxCodeOptions}
      gstRegistered={gstRegistered}
      actions={actions}
      getQuantity={(line) => getLineQuantity(line, quantityField)}
      stockLocationId={stockLocationId}
    />
  );

  if (!showSectionTitle) return grid;

  return (
    <DocumentLineEntrySection
      title="Lines"
      fillHeight={fillHeight}
      showSectionTitle={showSectionTitle}
      headerAction={headerControls}
    >
      {grid}
    </DocumentLineEntrySection>
  );
}
