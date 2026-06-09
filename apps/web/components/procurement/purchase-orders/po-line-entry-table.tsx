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
import type { PoLineColumnId } from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";
import { usePoLineEntryActions } from "@/components/procurement/purchase-orders/po-line-entry-actions";
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
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void;
};

const PO_LINE_COLUMN_WIDTH: Partial<Record<PoLineColumnId | typeof PO_LINE_IMAGE_COLUMN_ID, string>> = {
  [PO_LINE_IMAGE_COLUMN_ID]: "w-[3.25rem]",
  item: "min-w-[12rem] w-auto sm:min-w-[16rem]",
  quantity_ordered: "w-[4.5rem]",
  unit_price: "w-[5.5rem]",
  line_total: "w-[5.5rem]",
};

const PO_LINE_EDITABLE_COLUMN_IDS = new Set<PoLineColumnId>([
  "item",
  "quantity_ordered",
  "unit_price",
]);

function PoLineEntryGrid({
  lines,
  supplierId,
  destinationLocationId,
  excludePurchaseOrderId,
  disabled,
  fillHeight,
  layout: layoutProp,
  actions,
}: {
  lines: PoDraftLine[];
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  disabled: boolean;
  fillHeight: boolean;
  layout: DocumentLayoutTemplate;
  actions: ReturnType<typeof usePoLineEntryActions>;
}) {
  const layout = useMemo(() => normalizePoLayoutTemplate(layoutProp), [layoutProp]);
  const imageDisplayMode = useMemo(() => resolvePoLineImageDisplayMode(layout), [layout]);
  const visibleColumns = useMemo(() => getPoLineEntryTableColumns(layout), [layout]);
  const nestedColumns = useMemo(() => getItemDetailLineFields(layout), [layout]);

  const columns: DocumentLineColumn[] = useMemo(
    () =>
      visibleColumns.map((column) => ({
        id: column.id,
        label: column.id === PO_LINE_IMAGE_COLUMN_ID ? "" : column.label,
        align: column.align,
        widthClass: PO_LINE_COLUMN_WIDTH[column.id as PoLineColumnId | typeof PO_LINE_IMAGE_COLUMN_ID],
        editable: PO_LINE_EDITABLE_COLUMN_IDS.has(column.id as PoLineColumnId),
        headerClassName:
          column.id === PO_LINE_IMAGE_COLUMN_ID ? "w-[3.25rem] px-0" : undefined,
      })),
    [visibleColumns]
  );

  const minTableWidth =
    imageDisplayMode === "SEPARATE_COLUMN" ? "min-w-[38rem]" : "min-w-[34rem]";

  return (
    <DocumentLineEntryGrid
      lines={lines}
      columns={columns}
      minTableWidth={minTableWidth}
      fillHeight={fillHeight}
      disabled={disabled}
      canRemoveLine={(_, __, allLines) => allLines.length > 1}
      onRemoveLine={actions.removeLine}
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
          imageDisplayMode
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
  onChange,
}: Props) {
  const resolvedLayout = useMemo(() => normalizePoLayoutTemplate(layout), [layout]);
  const actions = usePoLineEntryActions(lines, supplierId, onChange);
  usePoLineCatalogHydration(lines, onChange);

  useEffect(() => {
    prefetchBrowseVariants();
  }, []);

  return (
    <DocumentLineEntrySection
      title="Lines"
      fillHeight={fillHeight}
      showSectionTitle={showSectionTitle}
    >
      <PoLineEntryGrid
        lines={lines}
        supplierId={supplierId}
        destinationLocationId={destinationLocationId}
        excludePurchaseOrderId={excludePurchaseOrderId}
        disabled={disabled}
        fillHeight={fillHeight}
        layout={resolvedLayout}
        actions={actions}
      />
    </DocumentLineEntrySection>
  );
}
