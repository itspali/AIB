"use client";

import { useEffect, useMemo } from "react";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getItemDetailLineFields,
  getPoLineEntryTableColumns,
  normalizePoLayoutTemplate,
  PO_LINE_IMAGE_COLUMN_ID,
  resolvePoLineImageDisplayMode,
} from "@/lib/documents/purchase-order-layout";
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
import { PoLineEntryAnchorToggle } from "@/components/procurement/purchase-orders/po-line-entry-anchor-toggle";
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
  entryAnchor?: PoLineEntryAnchor;
  onEntryAnchorChange?: (anchor: PoLineEntryAnchor) => void;
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void;
};

const PO_LINE_EDITABLE_COLUMN_IDS = new Set<string>([
  "item",
  "quantity_ordered",
  "unit_price",
  "discount_pct",
  "discount_amount",
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

  const columns: DocumentLineColumn[] = useMemo(
    () =>
      visibleColumns.map((column) => ({
        id: column.id,
        label: column.id === PO_LINE_IMAGE_COLUMN_ID ? "" : column.label,
        align: column.align,
        widthClass: getDocumentLineColumnWidthClass(column.id),
        colWidthRem: getDocumentLineColumnWidthRem(column.id),
        colMinWidthRem: getDocumentLineColumnMinWidthRem(column.id),
        editable: PO_LINE_EDITABLE_COLUMN_IDS.has(column.id),
        headerClassName:
          column.id === PO_LINE_IMAGE_COLUMN_ID ? "w-[3.25rem] px-0" : undefined,
      })),
    [visibleColumns]
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
          itemRefs: actions.itemRefs,
          qtyRefs: actions.qtyRefs,
          priceRefs: actions.priceRefs,
          patchLine: actions.patchLine,
          bindItemChange: actions.bindItemChange,
          focusPrice: actions.focusPrice,
          advanceFromLine: actions.advanceFromLine,
        };

        return renderPoLineColumnCell(
          column.id,
          layoutColumn,
          ctx,
          nestedColumns,
          imageDisplayMode,
          showUnitUnderQty
        );
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

  return (
    <DocumentLineEntrySection
      title="Lines"
      fillHeight={fillHeight}
      showSectionTitle={showSectionTitle}
      headerAction={showSectionTitle ? anchorToggle : null}
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
        actions={actions}
      />
    </DocumentLineEntrySection>
  );
}
