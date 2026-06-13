"use client";

import { useMemo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import { resolveColumnDecimalPlaces } from "@/lib/documents/decimal-format";
import { resolvePoPeekLineCellDisplay } from "@/lib/documents/peek-line-display";
import { getPoPeekLineColumns, resolvePoFormFieldsGridProps } from "@/lib/documents/po-form-layout";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getItemDetailLineFields,
  getPoLayoutColumnPref,
  getVisibleHeaderFields,
  isPoLineColumnVisible,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoPeekLineDisplayOptions } from "@/lib/documents/peek-line-display";
import { formatDate } from "@/lib/dashboard/format";
import {
  purchaseOrderStatusBadgeVariant,
  purchaseOrderStatusLabel,
} from "@/lib/procurement/purchase-orders/labels";
import { parsePurchaseOrderCustomFields } from "@/lib/procurement/purchase-orders/custom-fields";
import type { PurchaseOrderCustomFields } from "@/lib/procurement/purchase-orders/custom-fields";
import type { PurchaseOrderLineRow, PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import {
  PO_PRICES_TAX_MODE_LABEL,
  poPricesTaxInclusiveToMode,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import {
  poTaxSupplyNatureLabel,
} from "@/lib/procurement/purchase-orders/po-tax-supply";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import {
  formatPoPeekLineUomConversionHint,
  resolvePoPeekLineUnitCode,
  shouldShowPoUnitUnderQtyColumn,
} from "@/lib/procurement/purchase-orders/po-line-unit";
import {
  PO_LINE_SUBLINE_TEXT_CLASS,
  PoLineQtyUnitSlot,
  PoLineQtyValueStack,
  PoLineSublineRow,
  PoLineSublineZone,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { PoAddressBlocks } from "@/components/procurement/purchase-orders/po-address-blocks";
import { PoPromoEntitlementsPanel } from "@/components/procurement/purchase-orders/po-promo-entitlements-panel";
import { cn } from "@/lib/utils";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import { resolvePoAddressBlocksForOrder } from "@/lib/procurement/purchase-orders/resolve-po-address-blocks";
import {
  formatPoLineMrpReference,
  resolvePeekLineMrp,
  resolvePeekLineMrpMarkdownPct,
  resolvePoLineMrpVarianceDirection,
  shouldShowPeekMrpTradeTermsStack,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import { PoLineMrpVarianceArrow } from "@/components/procurement/purchase-orders/po-line-mrp-markdown-slot";
import {
  DOCUMENT_LINE_ROW_BASE,
  DOCUMENT_LINE_ROW_CELL_HOVER,
} from "@/components/documents/document-line-entry-grid";

type Props = {
  order: PurchaseOrderRow;
  layout?: DocumentLayoutTemplate;
  organizationBillTo: OrganizationBillToSnapshot;
};

function resolvePeekHeaderValue(
  fieldId: string,
  order: PurchaseOrderRow,
  customFields: PurchaseOrderCustomFields
): ReactNode {
  switch (fieldId) {
    case "voucher_number":
      return (
        <p className="truncate font-mono text-sm font-medium">{order.voucher_number}</p>
      );
    case "supplier":
      return <p className="truncate text-sm font-medium">{order.supplier_name}</p>;
    case "destination":
      return (
        <p className="truncate text-sm font-medium">{order.destination_location_name}</p>
      );
    case "tax_supply_nature":
      return (
        <p className="text-sm font-medium">{poTaxSupplyNatureLabel(order.tax_supply_nature)}</p>
      );
    case "currency":
      return <p className="text-sm font-medium">{order.currency_code}</p>;
    case "document_status":
      return (
        <Badge variant={purchaseOrderStatusBadgeVariant(order.document_status)}>
          {purchaseOrderStatusLabel(order.document_status)}
        </Badge>
      );
    case "payment_terms_days":
      return <p className="text-sm">{order.payment_terms_days} days</p>;
    case "created_at":
      return <p className="truncate text-sm">{formatDate(order.created_at)}</p>;
    case "created_by":
      return <p className="truncate text-sm">{order.created_by_name?.trim() || "—"}</p>;
    case "updated_at":
      return <p className="truncate text-sm">{formatDate(order.updated_at)}</p>;
    case "requisition_number":
      return (
        <p className="truncate text-sm">{customFields.requisition_number || "—"}</p>
      );
    case "expected_delivery_date":
      return (
        <p className="truncate text-sm">{customFields.expected_delivery_date || "—"}</p>
      );
    case "internal_notes":
      return <p className="text-sm">{customFields.internal_notes || "—"}</p>;
    default:
      return null;
  }
}

function PeekHeaderField({
  field,
  order,
  customFields,
}: {
  field: DocumentColumnPref;
  order: PurchaseOrderRow;
  customFields: PurchaseOrderCustomFields;
}) {
  const value = resolvePeekHeaderValue(field.id, order, customFields);
  if (value == null) return null;

  return (
    <div className="min-w-0 w-full">
      <p
        className={documentFieldTypographyClassName(
          field,
          "text-xs font-medium text-muted-foreground"
        )}
      >
        {field.label}
      </p>
      {value}
    </div>
  );
}

function PeekLineNestedDetailFields({
  line,
  nestedColumns,
  peekDisplayOptions,
}: {
  line: PurchaseOrderLineRow;
  nestedColumns: DocumentColumnPref[];
  peekDisplayOptions?: PoPeekLineDisplayOptions;
}) {
  const columnsToRender = nestedColumns.filter((column) => {
    const value = resolvePoPeekLineCellDisplay(column, line, peekDisplayOptions);
    return value != null && value !== "" && value !== "—";
  });
  const detailRows = groupItemDetailRows(columnsToRender);
  if (detailRows.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1 border-t border-border/50 pt-1.5 text-xs leading-snug text-muted-foreground">
      {detailRows.map((rowColumns, rowIndex) =>
        rowColumns.length > 1 ? (
          <div
            key={`inline-${rowIndex}`}
            className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0"
          >
            {rowColumns.map((column, columnIndex) => {
              const displayValue = resolvePoPeekLineCellDisplay(column, line, peekDisplayOptions);
              if (!displayValue || displayValue === "—") return null;
              return (
                <span
                  key={column.id}
                  className={documentFieldTypographyClassName(
                    column,
                    "inline-flex min-w-0 items-baseline gap-1"
                  )}
                >
                  {columnIndex > 0 ? (
                    <span className="text-muted-foreground/45" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {column.showLabel !== false ? (
                    <span className="shrink-0">{column.label}:</span>
                  ) : null}
                  <span
                    className={cn(
                      "min-w-0 truncate text-foreground",
                      column.id === "sku" && "font-mono"
                    )}
                  >
                    {displayValue}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          (() => {
            const column = rowColumns[0]!;
            const displayValue = resolvePoPeekLineCellDisplay(column, line, peekDisplayOptions);
            if (!displayValue || displayValue === "—") return null;
            return (
              <div
                key={column.id}
                className={documentFieldTypographyClassName(
                  column,
                  "flex min-w-0 items-baseline gap-1"
                )}
              >
                {column.showLabel !== false ? (
                  <span className="shrink-0">{column.label}:</span>
                ) : null}
                <span
                  className={cn(
                    "min-w-0 truncate text-foreground",
                    column.id === "sku" && "font-mono"
                  )}
                >
                  {displayValue}
                </span>
              </div>
            );
          })()
        )
      )}
    </div>
  );
}

function PeekLineItemCell({
  line,
  skuLineFieldVisible,
  nestedColumns,
  peekDisplayOptions,
}: {
  line: PurchaseOrderLineRow;
  skuLineFieldVisible: boolean;
  nestedColumns: DocumentColumnPref[];
  peekDisplayOptions?: PoPeekLineDisplayOptions;
}) {
  const showSkuUnderItem = !skuLineFieldVisible && Boolean(line.variant_sku);

  return (
    <td className={cn("p-2 align-top", DOCUMENT_LINE_ROW_CELL_HOVER)}>
      <div className="truncate text-xs font-medium">{line.item_name}</div>
      {showSkuUnderItem && line.variant_sku ? (
        <div className="truncate font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
      ) : null}
      <PeekLineNestedDetailFields
        line={line}
        nestedColumns={nestedColumns}
        peekDisplayOptions={peekDisplayOptions}
      />
    </td>
  );
}

function PeekLineQtyCell({
  line,
  column,
  showUnitUnderQty,
}: {
  line: PurchaseOrderLineRow;
  column: DocumentColumnPref;
  showUnitUnderQty: boolean;
}) {
  const value = resolvePoPeekLineCellDisplay(column, line) ?? "—";
  const unitCode = showUnitUnderQty ? resolvePoPeekLineUnitCode(line) : null;
  const conversionHint = showUnitUnderQty ? formatPoPeekLineUomConversionHint(line) : null;

  return (
    <td
      className={documentFieldTypographyClassName(
        column,
        cn(
          "align-top tabular-nums",
          showUnitUnderQty ? "p-0" : "p-2",
          column.align === "right" ? "text-right" : "text-left",
          DOCUMENT_LINE_ROW_CELL_HOVER
        )
      )}
    >
      <PoLineQtyValueStack
        showUnitUnderQty={showUnitUnderQty}
        align={column.align}
        unitSlot={
          <PoLineQtyUnitSlot
            unitCode={unitCode}
            align={column.align}
            className="w-full px-0"
            conversionHint={conversionHint}
          />
        }
      >
        <span
          className={cn(
            "block h-8 leading-8 tabular-nums",
            column.align === "right" ? "text-right" : "text-left"
          )}
        >
          {value}
        </span>
      </PoLineQtyValueStack>
    </td>
  );
}

function PeekLineValueCell({
  line,
  column,
  peekDisplayOptions,
}: {
  line: PurchaseOrderLineRow;
  column: DocumentColumnPref;
  peekDisplayOptions?: PoPeekLineDisplayOptions;
}) {
  const value = resolvePoPeekLineCellDisplay(column, line, peekDisplayOptions) ?? "—";

  return (
    <td
      className={documentFieldTypographyClassName(
        column,
        cn(
          "p-2 tabular-nums",
          column.align === "right" ? "text-right" : "text-left",
          DOCUMENT_LINE_ROW_CELL_HOVER
        )
      )}
    >
      {value}
    </td>
  );
}

function PeekLinePriceCell({
  line,
  column,
  enableMrpTradeTerms = true,
  mrpColumnVisible = false,
}: {
  line: PurchaseOrderLineRow;
  column: DocumentColumnPref;
  enableMrpTradeTerms?: boolean;
  mrpColumnVisible?: boolean;
}) {
  const value = resolvePoPeekLineCellDisplay(column, line) ?? "—";
  const markdownPct = resolvePeekLineMrpMarkdownPct(line);
  const mrp = resolvePeekLineMrp(line);
  const unitPrice = Number(line.unit_price_contractual ?? 0);
  const varianceDirection = resolvePoLineMrpVarianceDirection(mrp, unitPrice);
  const hasMarkdownDisplay = Boolean(markdownPct && markdownPct !== "0.00");
  const hasVarianceDisplay = varianceDirection != null;
  const showMrpStack =
    shouldShowPeekMrpTradeTermsStack(line, enableMrpTradeTerms) &&
    (!mrpColumnVisible || hasMarkdownDisplay || hasVarianceDisplay);

  return (
    <td
      className={documentFieldTypographyClassName(
        column,
        cn(
          "align-top tabular-nums",
          showMrpStack ? "p-0" : "p-2",
          column.align === "right" ? "text-right" : "text-left",
          DOCUMENT_LINE_ROW_CELL_HOVER
        )
      )}
    >
      <PoLineQtyValueStack
        showUnitUnderQty={showMrpStack}
        align={column.align}
        unitSlot={
          showMrpStack ? (
            <PoLineSublineZone align={column.align}>
              <PoLineSublineRow align={column.align} reserve={!hasMarkdownDisplay && !hasVarianceDisplay}>
                {hasMarkdownDisplay || hasVarianceDisplay ? (
                  <span
                    className={cn(
                      "flex w-full min-w-0 items-center gap-1 px-2 tabular-nums",
                      PO_LINE_SUBLINE_TEXT_CLASS,
                      column.align === "right" && "justify-end text-right",
                      column.align === "center" && "justify-center text-center"
                    )}
                  >
                    {markdownPct ?? "0"}%
                    <PoLineMrpVarianceArrow direction={varianceDirection} />
                  </span>
                ) : null}
              </PoLineSublineRow>
              <PoLineSublineRow align={column.align} reserve={mrpColumnVisible}>
                {!mrpColumnVisible ? (
                  <span
                    className={cn(
                      "w-full truncate px-2 tabular-nums",
                      PO_LINE_SUBLINE_TEXT_CLASS,
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center"
                    )}
                  >
                    MRP {formatPoLineMrpReference(mrp, 2)}
                  </span>
                ) : null}
              </PoLineSublineRow>
            </PoLineSublineZone>
          ) : null
        }
      >
        <span
          className={cn(
            "block h-8 leading-8 tabular-nums",
            showMrpStack && "px-2",
            column.align === "right" ? "text-right" : "text-left"
          )}
        >
          {value}
        </span>
      </PoLineQtyValueStack>
    </td>
  );
}

export function PoPeekView({
  order,
  layout = DEFAULT_PO_SCREEN_LAYOUT,
  organizationBillTo,
}: Props) {
  const customFields = parsePurchaseOrderCustomFields(order.custom_fields);
  const resolvedLayout = useMemo(() => normalizePoLayoutTemplate(layout), [layout]);
  const addressBlocks = useMemo(
    () => resolvePoAddressBlocksForOrder(order, organizationBillTo),
    [order, organizationBillTo]
  );
  const headerFields = getVisibleHeaderFields(resolvedLayout);
  const lineColumns = useMemo(() => getPoPeekLineColumns(resolvedLayout), [resolvedLayout]);
  const nestedColumns = useMemo(() => getItemDetailLineFields(resolvedLayout), [resolvedLayout]);
  const skuLineFieldVisible = isPoLineColumnVisible("sku", resolvedLayout);
  const showUnitUnderQty = shouldShowPoUnitUnderQtyColumn(resolvedLayout);
  const mrpColumnVisible = useMemo(
    () => lineColumns.some((column) => column.id === "mrp"),
    [lineColumns]
  );
  const peekDisplayOptions = useMemo<PoPeekLineDisplayOptions>(
    () => ({
      discountAmountColumn: getPoLayoutColumnPref(resolvedLayout, "discount_amount"),
      taxSupplyNature: order.tax_supply_nature,
    }),
    [resolvedLayout, order.tax_supply_nature]
  );
  const grandTotalField = resolvedLayout.columns.find((column) => column.id === "grand_total");
  const grandTotalDecimals = grandTotalField
    ? resolveColumnDecimalPlaces(grandTotalField)
    : 2;
  const showPromoEntitlements =
    order.document_status !== "DRAFT" && order.document_status !== "CANCELLED";

  const gridFields = headerFields.filter((field) => field.id !== "internal_notes");
  const internalNotesField = headerFields.find((field) => field.id === "internal_notes");
  const headerGrid = resolvePoFormFieldsGridProps(gridFields.length);

  return (
    <div className="space-y-6">
      {addressBlocks.length > 0 ? <PoAddressBlocks blocks={addressBlocks} /> : null}

      {gridFields.length > 0 ? (
        <div className={cn("min-w-0", headerGrid.containerClassName)}>
          <div className={cn(headerGrid.gridClassName, "gap-x-3 gap-y-4")}>
            {gridFields.map((field) => (
              <PeekHeaderField
                key={field.id}
                field={field}
                order={order}
                customFields={customFields}
              />
            ))}
          </div>
        </div>
      ) : null}

      {internalNotesField ? (
        <PeekHeaderField
          field={internalNotesField}
          order={order}
          customFields={customFields}
        />
      ) : null}

      {showPromoEntitlements ? (
        <PoPromoEntitlementsPanel
          purchaseOrderId={order.id}
          allowWriteOff
          variant="full"
        />
      ) : null}

      {lineColumns.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lines
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="administrative" className="text-xs font-normal">
                {PO_PRICES_TAX_MODE_LABEL[poPricesTaxInclusiveToMode(order.prices_tax_inclusive)]}
              </Badge>
              <p className="text-sm font-semibold tabular-nums">
                Total {formatPoMoney(Number(order.total_net_amount) || 0, grandTotalDecimals)}
              </p>
            </div>
          </div>
          <div className="po-peek-lines-table po-line-grid-scroll">
            <table className="w-full min-w-[34rem] table-fixed text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="sticky top-0 z-[5] w-10 bg-muted/95 p-2 text-center backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                    #
                  </th>
                  {lineColumns.map((column) => (
                    <th
                      key={column.id}
                      className={documentFieldTypographyClassName(
                        column,
                        cn(
                          "sticky top-0 z-[5] bg-muted/95 p-2 backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]",
                          column.align === "right" ? "text-right" : "text-left"
                        )
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(order.lines ?? []).map((line, lineIndex) => (
                  <tr
                    key={line.id}
                    className={cn("border-b border-border", DOCUMENT_LINE_ROW_BASE)}
                  >
                    <td
                      className={cn(
                        "w-10 p-2 text-center tabular-nums text-xs text-muted-foreground",
                        DOCUMENT_LINE_ROW_CELL_HOVER
                      )}
                    >
                      {lineIndex + 1}
                    </td>
                    {lineColumns.map((column) =>
                      column.id === "item" ? (
                        <PeekLineItemCell
                          key={column.id}
                          line={line}
                          skuLineFieldVisible={skuLineFieldVisible}
                          nestedColumns={nestedColumns}
                          peekDisplayOptions={peekDisplayOptions}
                        />
                      ) : column.id === "quantity_ordered" ? (
                        <PeekLineQtyCell
                          key={column.id}
                          line={line}
                          column={column}
                          showUnitUnderQty={showUnitUnderQty}
                        />
                      ) : column.id === "unit_price" ? (
                        <PeekLinePriceCell
                          key={column.id}
                          line={line}
                          column={column}
                          mrpColumnVisible={mrpColumnVisible}
                        />
                      ) : (
                        <PeekLineValueCell
                          key={column.id}
                          line={line}
                          column={column}
                          peekDisplayOptions={peekDisplayOptions}
                        />
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
