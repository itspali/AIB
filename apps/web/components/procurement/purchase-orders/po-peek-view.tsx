"use client";

import { useMemo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  documentFieldLabelTypographyClassName,
  documentFieldValueTypographyClassName,
} from "@/lib/documents/document-typography-classes";
import { resolveColumnDecimalPlaces } from "@/lib/documents/decimal-format";
import {
  PO_PRICES_TAX_MODE_LABEL,
  poPricesTaxInclusiveToMode,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { resolvePoPeekLineCellDisplay } from "@/lib/documents/peek-line-display";
import { getPoPeekLineColumns, resolvePoFormFieldsGridProps } from "@/lib/documents/po-form-layout";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLayoutColumnPref,
  getItemDetailLineFields,
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
  resolveSavedPoLineTaxDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { shouldShowPoTaxRateUnderLineTaxColumn } from "@/lib/procurement/purchase-orders/po-line-tax";
import { poTaxSupplyNatureLabel } from "@/lib/procurement/purchase-orders/po-tax-supply";
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
  PoLineSublineSingleRow,
  PoLineSublineZone,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { PoAddressBlocks } from "@/components/procurement/purchase-orders/po-address-blocks";
import { PoPromoEntitlementsPanel } from "@/components/procurement/purchase-orders/po-promo-entitlements-panel";
import { poPeekShowsPromoEntitlements } from "@/lib/procurement/purchase-orders/po-peek-promo";
import type { PoPromoEntitlementRow } from "@/lib/procurement/promo/entitlements";
import { cn } from "@/lib/utils";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import { resolvePoAddressBlocksForOrder } from "@/lib/procurement/purchase-orders/resolve-po-address-blocks";
import {
  DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
  DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS,
} from "@/components/documents/document-line-entry-cells";
import {
  DOCUMENT_LINE_ROW_BASE,
  DOCUMENT_LINE_ROW_CELL_HOVER,
} from "@/components/documents/document-line-entry-grid";

type Props = {
  order: PurchaseOrderRow;
  layout?: DocumentLayoutTemplate;
  organizationBillTo: OrganizationBillToSnapshot;
  enableMrpTradeTerms?: boolean;
  promoEntitlements?: PoPromoEntitlementRow[];
  promoLoadError?: string | null;
};

function peekLineCellClass(column: DocumentColumnPref, extra?: string) {
  return cn(
    "p-0 align-top",
    column.align === "right"
      ? "text-right"
      : column.align === "center"
        ? "text-center"
        : "text-left",
    DOCUMENT_LINE_ROW_CELL_HOVER,
    extra
  );
}

function peekPrimaryAlignClass(align: DocumentColumnPref["align"] | undefined) {
  return align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
}

function resolvePeekLineTaxAmount(line: PurchaseOrderLineRow) {
  return resolveSavedPoLineTaxDisplay(line);
}

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
        className={documentFieldLabelTypographyClassName(
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
                  className="inline-flex min-w-0 items-baseline gap-1"
                >
                  {columnIndex > 0 ? (
                    <span className="text-muted-foreground/45" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {column.showLabel !== false ? (
                    <span className={documentFieldLabelTypographyClassName(column, "shrink-0")}>
                      {column.label}:
                    </span>
                  ) : null}
                  <span
                    className={documentFieldValueTypographyClassName(
                      column,
                      cn("min-w-0 truncate text-foreground", column.id === "sku" && "font-mono")
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
                className="flex min-w-0 items-baseline gap-1"
              >
                {column.showLabel !== false ? (
                  <span className={documentFieldLabelTypographyClassName(column, "shrink-0")}>
                    {column.label}:
                  </span>
                ) : null}
                <span
                  className={documentFieldValueTypographyClassName(
                    column,
                    cn("min-w-0 truncate text-foreground", column.id === "sku" && "font-mono")
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
    <td className={cn("min-w-0 p-0 align-top whitespace-normal", DOCUMENT_LINE_ROW_CELL_HOVER)}>
      <div className="min-w-0 px-2 py-2 text-sm">
        <div className="truncate text-xs font-medium">{line.item_name}</div>
        {showSkuUnderItem && line.variant_sku ? (
          <div className="truncate font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
        ) : null}
        <PeekLineNestedDetailFields
          line={line}
          nestedColumns={nestedColumns}
          peekDisplayOptions={peekDisplayOptions}
        />
      </div>
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
    <td className={peekLineCellClass(column, "tabular-nums")}>
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
          className={documentFieldValueTypographyClassName(
            column,
            cn(DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS, peekPrimaryAlignClass(column.align))
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
    <td className={peekLineCellClass(column, "tabular-nums")}>
      <div
        className={documentFieldValueTypographyClassName(
          column,
          cn(DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS, peekPrimaryAlignClass(column.align))
        )}
      >
        {value}
      </div>
    </td>
  );
}

function PeekLineTaxCell({
  line,
  column,
  taxRateColumn,
  showTaxRateSubline,
  peekDisplayOptions,
}: {
  line: PurchaseOrderLineRow;
  column: DocumentColumnPref;
  taxRateColumn?: DocumentColumnPref | null;
  showTaxRateSubline: boolean;
  peekDisplayOptions?: PoPeekLineDisplayOptions;
}) {
  const value = resolvePoPeekLineCellDisplay(column, line, peekDisplayOptions) ?? "—";
  const showStack =
    showTaxRateSubline && Boolean(line.variant_id) && Boolean(taxRateColumn);

  if (!showStack || !taxRateColumn) {
    return (
      <td className={peekLineCellClass(column, "tabular-nums")}>
        <div
          className={documentFieldValueTypographyClassName(
            column,
            cn(DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS, peekPrimaryAlignClass(column.align))
          )}
        >
          {value}
        </div>
      </td>
    );
  }

  const rateDisplay =
    resolvePoPeekLineCellDisplay(taxRateColumn, line, peekDisplayOptions) ?? "—";

  return (
    <td className={peekLineCellClass(column, "tabular-nums")}>
      <PoLineQtyValueStack
        showUnitUnderQty
        align={column.align}
        unitSlot={
          <PoLineSublineSingleRow align={column.align}>
            <span
              className={cn(
                "w-full truncate px-2 tabular-nums",
                PO_LINE_SUBLINE_TEXT_CLASS,
                peekPrimaryAlignClass(column.align)
              )}
            >
              {rateDisplay}
            </span>
          </PoLineSublineSingleRow>
        }
      >
        <span
          className={documentFieldValueTypographyClassName(
            column,
            cn(DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS, peekPrimaryAlignClass(column.align))
          )}
        >
          {value}
        </span>
      </PoLineQtyValueStack>
    </td>
  );
}

function PeekLineTotalCell({
  line,
  column,
}: {
  line: PurchaseOrderLineRow;
  column: DocumentColumnPref;
}) {
  const decimalPlaces = resolveColumnDecimalPlaces(column);
  const resolved = resolvePeekLineTaxAmount(line);
  const primaryValue = formatPoMoney(resolved.primaryAmount, decimalPlaces);
  const exTaxValue = formatPoMoney(resolved.taxableBase, decimalPlaces);

  if (!resolved.showExTaxSubline) {
    return (
      <td className={peekLineCellClass(column, "tabular-nums")}>
        <div
          className={documentFieldValueTypographyClassName(
            column,
            cn(DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS, peekPrimaryAlignClass(column.align))
          )}
        >
          {primaryValue}
        </div>
      </td>
    );
  }

  return (
    <td className={peekLineCellClass(column, "tabular-nums")}>
      <PoLineQtyValueStack
        showUnitUnderQty
        align={column.align}
        unitSlot={
          <PoLineSublineZone align={column.align}>
            <PoLineSublineRow align={column.align}>
              <span
                className={cn(
                  "w-full px-2",
                  PO_LINE_SUBLINE_TEXT_CLASS,
                  peekPrimaryAlignClass(column.align)
                )}
              >
                Before Tax
              </span>
            </PoLineSublineRow>
            <PoLineSublineRow align={column.align}>
              <span
                className={cn(
                  "w-full truncate px-2 tabular-nums",
                  PO_LINE_SUBLINE_TEXT_CLASS,
                  peekPrimaryAlignClass(column.align)
                )}
              >
                {exTaxValue}
              </span>
            </PoLineSublineRow>
          </PoLineSublineZone>
        }
      >
        <span
          className={documentFieldValueTypographyClassName(
            column,
            cn(DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS, peekPrimaryAlignClass(column.align))
          )}
        >
          {primaryValue}
        </span>
      </PoLineQtyValueStack>
    </td>
  );
}

export function PoPeekView({
  order,
  layout = DEFAULT_PO_SCREEN_LAYOUT,
  organizationBillTo,
  enableMrpTradeTerms = true,
  promoEntitlements = [],
  promoLoadError = null,
}: Props) {
  const customFields = parsePurchaseOrderCustomFields(order.custom_fields);
  const resolvedLayout = useMemo(() => normalizePoLayoutTemplate(layout), [layout]);
  const addressBlocks = useMemo(
    () => resolvePoAddressBlocksForOrder(order, organizationBillTo),
    [order, organizationBillTo]
  );
  const headerFields = getVisibleHeaderFields(resolvedLayout);
  const lineColumns = useMemo(
    () => getPoPeekLineColumns(resolvedLayout, { enableMrpTradeTerms }),
    [resolvedLayout, enableMrpTradeTerms]
  );
  const nestedColumns = useMemo(
    () => getItemDetailLineFields(resolvedLayout, { enableMrpTradeTerms }),
    [resolvedLayout, enableMrpTradeTerms]
  );
  const skuLineFieldVisible = isPoLineColumnVisible("sku", resolvedLayout);
  const showUnitUnderQty = shouldShowPoUnitUnderQtyColumn(resolvedLayout);
  const taxRateColumn = useMemo(
    () => getPoLayoutColumnPref(resolvedLayout, "tax_rate_pct"),
    [resolvedLayout]
  );
  const showTaxRateUnderLineTax = useMemo(
    () => shouldShowPoTaxRateUnderLineTaxColumn(resolvedLayout),
    [resolvedLayout]
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
  const showPromoEntitlements = poPeekShowsPromoEntitlements(order.document_status);

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
          initialEntitlements={promoEntitlements}
          initialLoadError={promoLoadError}
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
                      className={documentFieldLabelTypographyClassName(
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
                        "w-10 border border-border px-0 py-1 text-center align-top text-xs tabular-nums text-muted-foreground",
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
                        <PeekLineValueCell
                          key={column.id}
                          line={line}
                          column={column}
                          peekDisplayOptions={peekDisplayOptions}
                        />
                      ) : column.id === "line_tax_amount" ? (
                        <PeekLineTaxCell
                          key={column.id}
                          line={line}
                          column={column}
                          taxRateColumn={taxRateColumn}
                          showTaxRateSubline={showTaxRateUnderLineTax}
                          peekDisplayOptions={peekDisplayOptions}
                        />
                      ) : column.id === "line_total" ? (
                        <PeekLineTotalCell key={column.id} line={line} column={column} />
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
