"use client";

import { useMemo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
  DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS,
} from "@/components/documents/document-line-entry-cells";
import {
  DOCUMENT_LINE_ROW_BASE,
  DOCUMENT_LINE_ROW_CELL_HOVER,
} from "@/components/documents/document-line-entry-grid";
import {
  PO_LINE_SUBLINE_TEXT_CLASS,
  PoLineQtyUnitSlot,
  PoLineQtyValueStack,
  PoLineSublineRow,
  PoLineSublineSingleRow,
  PoLineSublineZone,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import { resolveColumnDecimalPlaces } from "@/lib/documents/decimal-format";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import {
  PO_PRICES_TAX_MODE_LABEL,
  poPricesTaxInclusiveToMode,
  resolveSavedPoLineTaxDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import { getSalesItemDetailLineFields, getSalesLayoutColumnPref } from "@/lib/sales/shared/sales-commerce-layout";
import {
  shouldShowSalesTaxRateUnderLineTaxColumn,
  shouldShowSalesUnitUnderQtyColumn,
} from "@/lib/sales/shared/sales-line-display";
import { getSalesPeekLineColumns } from "@/lib/sales/shared/sales-form-layout";
import {
  resolveSalesPeekLineCellDisplay,
  resolveSalesPeekLineTaxRateDisplay,
  resolveSalesPeekLineUnitCode,
  type SalesCommercePeekLineRow,
  type SalesPeekLineDisplayOptions,
  type SalesPeekLineTotalField,
  type SalesPeekQuantityField,
} from "@/lib/sales/shared/sales-peek-line-display";
import { formatSalesPeekLineUomConversionHint } from "@/lib/sales/shared/sales-line-uom-options";
import { useSalesDocumentLayout } from "@/lib/documents/use-sales-document-layout";
import { cn } from "@/lib/utils";

type Props<TLine extends SalesCommercePeekLineRow> = {
  lines: TLine[];
  layout: DocumentLayoutTemplate;
  quantityField: SalesPeekQuantityField;
  lineTotalField: SalesPeekLineTotalField;
  grandTotal: string | number;
  allowLineItemDiscounts?: boolean;
  pricesTaxInclusive?: boolean;
};

function peekLineCellClass(column: DocumentColumnPref, extra?: string) {
  return documentFieldTypographyClassName(
    column,
    cn(
      "p-0 align-top",
      column.align === "right"
        ? "text-right"
        : column.align === "center"
          ? "text-center"
          : "text-left",
      DOCUMENT_LINE_ROW_CELL_HOVER,
      extra
    )
  );
}

function peekPrimaryAlignClass(align: DocumentColumnPref["align"] | undefined) {
  return align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
}

function PeekLineNestedDetailFields<TLine extends SalesCommercePeekLineRow>({
  line,
  nestedColumns,
  peekDisplayOptions,
}: {
  line: TLine;
  nestedColumns: DocumentColumnPref[];
  peekDisplayOptions: SalesPeekLineDisplayOptions;
}) {
  const columnsToRender = nestedColumns.filter((column) => {
    const value = resolveSalesPeekLineCellDisplay(column, line, peekDisplayOptions);
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
              const displayValue = resolveSalesPeekLineCellDisplay(column, line, peekDisplayOptions);
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
            const displayValue = resolveSalesPeekLineCellDisplay(column, line, peekDisplayOptions);
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

function PeekLineItemCell<TLine extends SalesCommercePeekLineRow>({
  line,
  skuLineFieldVisible,
  nestedColumns,
  peekDisplayOptions,
}: {
  line: TLine;
  skuLineFieldVisible: boolean;
  nestedColumns: DocumentColumnPref[];
  peekDisplayOptions: SalesPeekLineDisplayOptions;
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

function PeekLineQtyCell<TLine extends SalesCommercePeekLineRow>({
  line,
  column,
  showUnitUnderQty,
  peekDisplayOptions,
}: {
  line: TLine;
  column: DocumentColumnPref;
  showUnitUnderQty: boolean;
  peekDisplayOptions: SalesPeekLineDisplayOptions;
}) {
  const value = resolveSalesPeekLineCellDisplay(column, line, peekDisplayOptions) ?? "—";
  const unitCode = showUnitUnderQty ? resolveSalesPeekLineUnitCode(line) : null;
  const quantity = line[peekDisplayOptions.quantityField]?.trim() ?? "";
  const conversionHint = showUnitUnderQty
    ? formatSalesPeekLineUomConversionHint({
        uom_code: line.uom_code,
        base_unit_of_measure: line.base_unit_of_measure,
        uom_conversion_factor: line.uom_conversion_factor,
        quantity,
      })
    : null;

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
          className={documentFieldTypographyClassName(
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

function PeekLineValueCell<TLine extends SalesCommercePeekLineRow>({
  line,
  column,
  peekDisplayOptions,
}: {
  line: TLine;
  column: DocumentColumnPref;
  peekDisplayOptions: SalesPeekLineDisplayOptions;
}) {
  const value = resolveSalesPeekLineCellDisplay(column, line, peekDisplayOptions) ?? "—";

  return (
    <td className={peekLineCellClass(column, "tabular-nums")}>
      <div
        className={documentFieldTypographyClassName(
          column,
          cn(DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS, peekPrimaryAlignClass(column.align))
        )}
      >
        {value}
      </div>
    </td>
  );
}

function PeekLineTaxCell<TLine extends SalesCommercePeekLineRow>({
  line,
  column,
  taxRateColumn,
  showTaxRateSubline,
  peekDisplayOptions,
}: {
  line: TLine;
  column: DocumentColumnPref;
  taxRateColumn?: DocumentColumnPref | null;
  showTaxRateSubline: boolean;
  peekDisplayOptions: SalesPeekLineDisplayOptions;
}) {
  const value = resolveSalesPeekLineCellDisplay(column, line, peekDisplayOptions) ?? "—";
  const rateDisplay = taxRateColumn
    ? resolveSalesPeekLineTaxRateDisplay(line, taxRateColumn, peekDisplayOptions.quantityField)
    : "—";
  const showStack =
    showTaxRateSubline &&
    Boolean(line.variant_id) &&
    Boolean(taxRateColumn) &&
    rateDisplay !== "—";

  if (!showStack || !taxRateColumn) {
    return (
      <td className={peekLineCellClass(column, "tabular-nums")}>
        <div
          className={documentFieldTypographyClassName(
            column,
            cn(DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS, peekPrimaryAlignClass(column.align))
          )}
        >
          {value}
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
          className={documentFieldTypographyClassName(
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

function PeekLineTotalCell<TLine extends SalesCommercePeekLineRow>({
  line,
  column,
  lineTotalField,
}: {
  line: TLine;
  column: DocumentColumnPref;
  lineTotalField: SalesPeekLineTotalField;
}) {
  const decimalPlaces = resolveColumnDecimalPlaces(column);

  if (lineTotalField === "line_total_net") {
    const lineTotalNet = Number(line.line_total_net) || 0;
    const taxAmount = Number(line.line_tax_amount) || 0;
    const beforeTax = lineTotalNet - taxAmount;
    const showBeforeTaxSubline = Boolean(line.variant_id) && taxAmount > 0;
    const primaryValue = formatPoMoney(lineTotalNet, decimalPlaces);
    const beforeTaxValue = formatPoMoney(beforeTax, decimalPlaces);

    if (!showBeforeTaxSubline) {
      return (
        <td className={peekLineCellClass(column, "tabular-nums")}>
          <div
            className={documentFieldTypographyClassName(
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
                  Before tax
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
                  {beforeTaxValue}
                </span>
              </PoLineSublineRow>
            </PoLineSublineZone>
          }
        >
          <span
            className={documentFieldTypographyClassName(
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

  const resolved = resolveSavedPoLineTaxDisplay({
    line_total_gross: line.line_total_gross ?? "0",
    line_tax_amount: line.line_tax_amount,
    variant_id: line.variant_id,
  });
  const primaryValue = formatPoMoney(resolved.primaryAmount, decimalPlaces);
  const exTaxValue = formatPoMoney(resolved.taxableBase, decimalPlaces);

  if (!resolved.showExTaxSubline) {
    return (
      <td className={peekLineCellClass(column, "tabular-nums")}>
        <div
          className={documentFieldTypographyClassName(
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
                Ex. tax
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
          className={documentFieldTypographyClassName(
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

export function SalesCommercePeekLinesSection<TLine extends SalesCommercePeekLineRow>({
  lines,
  layout,
  quantityField,
  lineTotalField,
  grandTotal,
  allowLineItemDiscounts = true,
  pricesTaxInclusive,
}: Props<TLine>) {
  const resolvedLayout = useSalesDocumentLayout(layout);
  const lineColumns = useMemo(
    () => getSalesPeekLineColumns(resolvedLayout, { allowLineItemDiscounts }),
    [resolvedLayout, allowLineItemDiscounts]
  );
  const nestedColumns = useMemo(
    () => getSalesItemDetailLineFields(resolvedLayout),
    [resolvedLayout]
  );
  const skuLineFieldVisible =
    getSalesLayoutColumnPref(resolvedLayout, "sku")?.defaultVisible === true;
  const showUnitUnderQty = shouldShowSalesUnitUnderQtyColumn(resolvedLayout);
  const taxRateColumn = useMemo(
    () => getSalesLayoutColumnPref(resolvedLayout, "tax_rate_pct"),
    [resolvedLayout]
  );
  const showTaxRateUnderLineTax = shouldShowSalesTaxRateUnderLineTaxColumn(resolvedLayout, {
    allowLineItemDiscounts,
  });
  const peekDisplayOptions = useMemo<SalesPeekLineDisplayOptions>(
    () => ({
      quantityField,
      lineTotalField,
      discountAmountColumn: getSalesLayoutColumnPref(resolvedLayout, "discount_amount"),
    }),
    [quantityField, lineTotalField, resolvedLayout]
  );
  const grandTotalField = resolvedLayout.columns.find((column) => column.id === "grand_total");
  const grandTotalDecimals = grandTotalField
    ? resolveColumnDecimalPlaces(grandTotalField)
    : 2;

  if (lineColumns.length === 0 || lines.length === 0) return null;

  const headerExtras: ReactNode[] = [];
  if (pricesTaxInclusive != null) {
    headerExtras.push(
      <Badge key="tax-mode" variant="administrative" className="text-xs font-normal">
        {PO_PRICES_TAX_MODE_LABEL[poPricesTaxInclusiveToMode(pricesTaxInclusive)]}
      </Badge>
    );
  }
  headerExtras.push(
    <p key="total" className="text-sm font-semibold tabular-nums">
      Total {formatPoMoney(Number(grandTotal) || 0, grandTotalDecimals)}
    </p>
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lines</p>
        <div className="flex flex-wrap items-center justify-end gap-2">{headerExtras}</div>
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
            {lines.map((line, lineIndex) => (
              <tr key={line.id} className={cn("border-b border-border", DOCUMENT_LINE_ROW_BASE)}>
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
                    <PeekLineTotalCell
                      key={column.id}
                      line={line}
                      column={column}
                      lineTotalField={lineTotalField}
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
  );
}
