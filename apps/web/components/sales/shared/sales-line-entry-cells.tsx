"use client";

import type { MutableRefObject } from "react";
import { StockVariantSkuField, type StockLineSkuSelection } from "@/components/inventory/stock/stock-variant-sku-field";
import {
  DOCUMENT_LINE_COMPACT_INPUT_CLASS,
  DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS,
  DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
  DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS,
  DocumentLineCompactInput,
} from "@/components/documents/document-line-entry-cells";
import { DocumentLineImage } from "@/components/documents/document-line-image";
import { DocumentLineHsnSacSlot } from "@/components/procurement/purchase-orders/po-line-hsn-slot";
import { PoLineDiscountTypeSlot } from "@/components/procurement/purchase-orders/po-line-discount-type-slot";
import { PoLineTaxCodeSlot } from "@/components/procurement/purchase-orders/po-line-tax-code-slot";
import {
  PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
  PO_LINE_SUBLINE_TEXT_CLASS,
  PoLineQtyUnitSlot,
  PoLineQtyValueStack,
  PoLineSublineRow,
  PoLineSublineSingleRow,
  PoLineSublineZone,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import {
  canEditSalesLineTaxRate,
  patchSalesLineTaxCodeSelection,
  resolveSalesDraftLineTaxAmount,
  resolveSalesDraftLineTaxAmountDisplay,
  resolveSalesDraftLineTaxRateDisplay,
} from "@/lib/sales/shared/sales-line-tax";
import {
  canEditSalesLineUom,
  formatSalesLineUomConversionHint,
  resolveSalesDraftLineUomCode,
  resolveSalesLineUomOptions,
  buildSalesDraftLineUomChangePatch,
} from "@/lib/sales/shared/sales-line-uom-options";
import { getCachedVariantBaseUnit, getCachedVariantImageUrl } from "@/lib/inventory/stock/variant-suggestion-cache";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import { resolveLineDetailFieldDisplay } from "@/lib/documents/catalog-line-values";
import { isCatalogFieldId } from "@/lib/documents/catalog-field-ids";
import { HSN_CATALOG_FIELD_ID } from "@/lib/documents/gst-document-layout-compliance";
import {
  formatDocumentDecimal,
  normalizeDocumentDecimalInput,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import type { DocumentColumnPref, DocumentImageDisplayMode } from "@/lib/documents/types";
import {
  formatPoLineComputedDiscountAmount,
  patchPoLineDiscountAmountInput,
  patchPoLineDiscountPercentInput,
  patchPoLineDiscountType,
  resolvePoLineDiscountDecimalPlaces,
  resolvePoLineDiscountInputValue,
  resolvePoLineDiscountType,
} from "@/lib/procurement/purchase-orders/po-line-discount";
import {
  patchSalesLineOfferUnitPrice,
  patchSalesLineOfferUnitPriceDraft,
  syncSalesLineSellingMarkdownFromOfferPrice,
} from "@/lib/sales/shared/sales-line-selling-markdown";
import {
  resolvePoUnitPriceAriaLabel,
  resolvePoUnitPriceColumnLabelFromLayout,
  resolvePoLineTotalPrimaryAmount,
  shouldShowPoLineTotalExTaxSubline,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import {
  SALES_LINE_IMAGE_COLUMN_ID,
  shouldShowSalesLineInlineImage,
} from "@/lib/sales/shared/sales-commerce-layout";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";
import { cn } from "@/lib/utils";

export function isSalesLineEnterKey(key: string): boolean {
  return key === "Enter";
}

export type SalesLineCellContext<T extends SalesCommerceLineBase> = {
  line: T;
  quantityField: string;
  unitPriceField: string;
  disabled: boolean;
  pricesTaxInclusive: boolean;
  taxMechanism: GstTaxMechanism;
  itemRefs: MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>;
  qtyRefs: MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>;
  priceRefs: MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>;
  patchLine: (key: string, patch: Partial<T>) => void;
  bindItemChange: (lineKey: string) => (patch: Partial<StockLineSkuSelection>) => void;
  focusPrice: (lineKey: string) => void;
  advanceFromLine: (lineKey: string) => void;
  getQuantity: (line: T) => string;
  gstRegistered?: boolean;
};

function patchSalesLineUomChange<T extends SalesCommerceLineBase>(
  ctx: SalesLineCellContext<T>,
  nextUomCode: string
) {
  const { line, patchLine, pricesTaxInclusive } = ctx;
  const uomPatch = buildSalesDraftLineUomChangePatch(line, nextUomCode);
  const nextLine = { ...line, ...uomPatch };
  const sync = syncSalesLineSellingMarkdownFromOfferPrice(nextLine, pricesTaxInclusive);
  patchLine(line.key, { ...uomPatch, ...(sync ?? {}) } as Partial<T>);
}

function toPoDiscountTotalsInput<T extends SalesCommerceLineBase>(
  line: T,
  getQuantity: (line: T) => string,
  unitPriceField: string
) {
  return {
    quantity_ordered: getQuantity(line),
    unit_price_contractual: String(line[unitPriceField as keyof T] ?? ""),
    discount_percentage: line.discount_percentage,
    discount_amount: line.discount_amount,
    discount_type: line.discount_type,
  };
}

function formatSalesLineComputedDiscountAmount<T extends SalesCommerceLineBase>(
  line: T,
  column: DocumentColumnPref,
  getQuantity: (line: T) => string,
  unitPriceField: string
): string {
  return formatPoLineComputedDiscountAmount(
    toPoDiscountTotalsInput(line, getQuantity, unitPriceField),
    column
  );
}

function resolveSalesLineImageUrl(line: SalesCommerceLineBase): string | null {
  const fromCatalog = line.catalog_context?.image_url?.trim();
  if (fromCatalog) return fromCatalog;
  const fromLine = line.image_url?.trim();
  if (fromLine) return fromLine;
  if (line.variant_id) return getCachedVariantImageUrl(line.variant_id);
  return null;
}

function resolveSalesLineUnitCode(line: SalesCommerceLineBase): string | null {
  return resolveSalesDraftLineUomCode(line);
}

function isSkuLineFieldVisible(columns: DocumentColumnPref[]): boolean {
  return columns.some((column) => column.id === "sku" && column.defaultVisible);
}

function resolveNestedFieldDisplay(
  column: DocumentColumnPref,
  line: SalesCommerceLineBase
): string | null {
  let commercial: string | null = null;
  if (column.id === "sku") commercial = line.variant_sku?.trim() || null;
  else if (column.id === "unit") commercial = resolveSalesLineUnitCode(line);
  return resolveLineDetailFieldDisplay(column, line.catalog_context, commercial);
}

function visibleNestedColumns(
  columns: DocumentColumnPref[],
  line: SalesCommerceLineBase,
  gstRegistered = false
): DocumentColumnPref[] {
  const filtered = columns.filter((column) => {
    if (gstRegistered && column.id === HSN_CATALOG_FIELD_ID && line.variant_id) {
      return true;
    }
    const value = resolveNestedFieldDisplay(column, line);
    return value != null && value !== "";
  });

  if (
    gstRegistered &&
    line.variant_id &&
    !filtered.some((column) => column.id === HSN_CATALOG_FIELD_ID)
  ) {
    const hsnColumn = columns.find((column) => column.id === HSN_CATALOG_FIELD_ID);
    if (hsnColumn) filtered.push(hsnColumn);
  }

  return filtered;
}

function renderNestedFieldContent<T extends SalesCommerceLineBase>({
  column,
  line,
  gstRegistered,
  disabled,
  patchLine,
}: {
  column: DocumentColumnPref;
  line: T;
  gstRegistered: boolean;
  disabled?: boolean;
  patchLine?: (key: string, patch: Partial<T>) => void;
}) {
  if (gstRegistered && column.id === HSN_CATALOG_FIELD_ID && patchLine) {
    return (
      <DocumentLineHsnSacSlot
        line={line}
        column={column}
        disabled={disabled}
        onPatch={(patch) => patchLine(line.key, patch)}
      />
    );
  }

  const displayValue = resolveNestedFieldDisplay(column, line);
  if (!displayValue) return null;

  return (
    <>
      {column.showLabel !== false ? (
        <span className="shrink-0">{column.label}:</span>
      ) : null}
      <span
        className={cn(
          "min-w-0 break-words text-foreground",
          column.id === "sku" && "font-mono"
        )}
      >
        {displayValue}
      </span>
    </>
  );
}

function SalesLineNestedUnderItemFields<T extends SalesCommerceLineBase>({
  line,
  nestedColumns,
  gstRegistered = false,
  disabled = false,
  patchLine,
}: {
  line: T;
  nestedColumns: DocumentColumnPref[];
  gstRegistered?: boolean;
  disabled?: boolean;
  patchLine?: (key: string, patch: Partial<T>) => void;
}) {
  if (!line.variant_id || nestedColumns.length === 0) return null;

  const columnsToRender = visibleNestedColumns(nestedColumns, line, gstRegistered);
  const detailRows = groupItemDetailRows(columnsToRender);
  const showSku =
    Boolean(line.variant_sku) &&
    !isSkuLineFieldVisible(nestedColumns) &&
    !columnsToRender.some((column) => isCatalogFieldId(column.id));

  if (!showSku && detailRows.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1 border-t border-border/50 px-0 pb-0.5 pt-1.5">
      {showSku ? (
        <div className="break-words font-mono text-xs leading-snug text-muted-foreground">
          {line.variant_sku}
        </div>
      ) : null}
      {detailRows.map((rowColumns, rowIndex) =>
        rowColumns.length > 1 ? (
          <div
            key={`inline-${rowIndex}`}
            className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 text-xs leading-snug"
          >
            {rowColumns.map((column, columnIndex) => {
              const content = renderNestedFieldContent({
                column,
                line,
                gstRegistered,
                disabled,
                patchLine,
              });
              if (!content) return null;
              return (
                <span
                  key={column.id}
                  className={documentFieldTypographyClassName(
                    column,
                    "inline-flex min-w-0 items-baseline gap-1 text-muted-foreground"
                  )}
                >
                  {columnIndex > 0 ? (
                    <span className="text-muted-foreground/45" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {content}
                </span>
              );
            })}
          </div>
        ) : (
          (() => {
            const column = rowColumns[0]!;
            const content = renderNestedFieldContent({
              column,
              line,
              gstRegistered,
              disabled,
              patchLine,
            });
            if (!content) return null;
            return (
              <div
                key={column.id}
                className={documentFieldTypographyClassName(
                  column,
                  "flex min-w-0 items-baseline gap-1 text-xs leading-snug text-muted-foreground"
                )}
              >
                {content}
              </div>
            );
          })()
        )
      )}
    </div>
  );
}

export function SalesLineImageCell<T extends SalesCommerceLineBase>({ line }: { line: T }) {
  return (
    <div className="flex items-center justify-center px-1 py-2">
      <DocumentLineImage imageUrl={resolveSalesLineImageUrl(line)} />
    </div>
  );
}

export function SalesLineItemCell<T extends SalesCommerceLineBase>({
  ctx,
  nestedColumns,
  itemColumn,
  imageDisplayMode,
}: {
  ctx: SalesLineCellContext<T>;
  nestedColumns: DocumentColumnPref[];
  itemColumn: DocumentColumnPref;
  imageDisplayMode: DocumentImageDisplayMode;
}) {
  const { line, disabled, unitPriceField, itemRefs, bindItemChange, gstRegistered = false, patchLine } =
    ctx;
  const skuLineFieldVisible = isSkuLineFieldVisible(nestedColumns);
  const showSkuFallback =
    Boolean(line.variant_sku) &&
    !skuLineFieldVisible &&
    !visibleNestedColumns(nestedColumns, line, gstRegistered).some((column) =>
      isCatalogFieldId(column.id)
    );
  const hideFieldSecondary =
    nestedColumns.length > 0 &&
    Boolean(line.variant_id) &&
    (skuLineFieldVisible ||
      visibleNestedColumns(nestedColumns, line, gstRegistered).length > 0 ||
      showSkuFallback);
  const showInlineImage = shouldShowSalesLineInlineImage(imageDisplayMode);

  return (
    <div className="min-w-0 px-2 py-2 text-sm">
      <div className="flex min-w-0 items-start gap-2">
        {showInlineImage ? (
          <DocumentLineImage imageUrl={resolveSalesLineImageUrl(line)} className="mt-0.5" />
        ) : null}
        <div className="min-w-0 flex-1">
          <StockVariantSkuField
            compact
            displayMode="item"
            wrapSelectedItemName
            disabled={disabled}
            inputClassName={documentFieldTypographyClassName(
              itemColumn,
              cn(DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS, "font-medium")
            )}
            showSecondaryText={!hideFieldSecondary}
            inputRef={(node) => {
              itemRefs.current[line.key] = node;
            }}
            value={{
              sku: line.sku,
              variant_id: line.variant_id,
              item_name: line.item_name,
              variant_sku: line.variant_sku,
              unit_cost: line[unitPriceField as keyof T] as string,
              skuError: line.skuError,
            }}
            onChange={bindItemChange(line.key)}
          />
        </div>
      </div>
      <SalesLineNestedUnderItemFields
        line={line}
        nestedColumns={nestedColumns}
        gstRegistered={gstRegistered}
        disabled={disabled}
        patchLine={patchLine}
      />
    </div>
  );
}

export function SalesLineUnitCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
}) {
  const { line, disabled, patchLine } = ctx;
  const unitCode = line.variant_id ? resolveSalesDraftLineUomCode(line) : null;
  const uomOptions = resolveSalesLineUomOptions(line).map((option) => option.uom_code);
  const conversionHint = line.variant_id ? formatSalesLineUomConversionHint(line, "") : null;

  return (
    <div
      className={cn("flex min-w-0 flex-col py-0.5", column.align === "right" && "items-end")}
    >
      <PoLineQtyUnitSlot
        unitCode={unitCode}
        align={column.align}
        editable={line.variant_id ? canEditSalesLineUom(line) : false}
        disabled={disabled}
        unitOptions={uomOptions}
        onUnitChange={(code) => patchSalesLineUomChange(ctx, code)}
        conversionHint={conversionHint}
        className="w-full text-sm leading-snug"
      />
    </div>
  );
}

export function SalesLineQtyCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
  showUnitUnderQty,
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
  showUnitUnderQty: boolean;
}) {
  const { line, disabled, qtyRefs, patchLine, focusPrice, getQuantity, quantityField } = ctx;
  const decimalPlaces = resolveColumnDecimalPlaces(column);
  const quantity = getQuantity(line);
  const unitCode = showUnitUnderQty && line.variant_id ? resolveSalesDraftLineUomCode(line) : null;
  const uomOptions = resolveSalesLineUomOptions(line).map((option) => option.uom_code);
  const editableUom = Boolean(line.variant_id) && canEditSalesLineUom(line);
  const conversionHint =
    showUnitUnderQty && line.variant_id ? formatSalesLineUomConversionHint(line, quantity) : null;
  const showQtyStack = showUnitUnderQty && Boolean(line.variant_id);

  const qtyInput = (
    <DocumentLineCompactInput
      ref={(node) => {
        qtyRefs.current[line.key] = node;
      }}
      align={column.align}
      className={documentFieldTypographyClassName(column, DOCUMENT_LINE_COMPACT_INPUT_CLASS)}
      value={quantity}
      disabled={disabled}
      inputMode="decimal"
      aria-label="Quantity"
      onChange={(event) =>
        patchLine(line.key, { [quantityField]: event.target.value } as Partial<T>)
      }
      onBlur={() => {
        const normalized = normalizeDocumentDecimalInput(quantity, decimalPlaces);
        if (normalized !== quantity) {
          patchLine(line.key, { [quantityField]: normalized } as Partial<T>);
        }
      }}
      onKeyDown={(event) => {
        if (!isSalesLineEnterKey(event.key)) return;
        event.preventDefault();
        if (line.variant_id && Number(quantity) > 0) {
          focusPrice(line.key);
        }
      }}
    />
  );

  return (
    <PoLineQtyValueStack
      showUnitUnderQty={showQtyStack}
      align={column.align}
      unitSlot={
        <PoLineQtyUnitSlot
          unitCode={unitCode}
          align={column.align}
          editable={editableUom}
          disabled={disabled}
          unitOptions={uomOptions}
          onUnitChange={(code) => patchSalesLineUomChange(ctx, code)}
          conversionHint={conversionHint}
          className="w-full"
        />
      }
    >
      {qtyInput}
    </PoLineQtyValueStack>
  );
}

export function SalesLinePriceCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
}) {
  const { line, disabled, unitPriceField, priceRefs, patchLine, advanceFromLine, pricesTaxInclusive } =
    ctx;
  const unitPrice = String(line[unitPriceField as keyof T] ?? "");

  return (
    <DocumentLineCompactInput
      ref={(node) => {
        priceRefs.current[line.key] = node;
      }}
      align={column.align}
      className={documentFieldTypographyClassName(column, DOCUMENT_LINE_COMPACT_INPUT_CLASS)}
      value={unitPrice}
      disabled={disabled}
      inputMode="decimal"
      aria-label={resolvePoUnitPriceAriaLabel(pricesTaxInclusive)}
      onChange={(event) =>
        patchLine(
          line.key,
          patchSalesLineOfferUnitPriceDraft(line, event.target.value, pricesTaxInclusive) as Partial<T>
        )
      }
      onBlur={() => {
        const normalized = patchSalesLineOfferUnitPrice(
          line,
          unitPrice,
          column,
          pricesTaxInclusive
        );
        if (
          normalized.unit_price_selling !== unitPrice ||
          normalized.selling_markdown_percentage !== line.selling_markdown_percentage
        ) {
          patchLine(line.key, normalized as Partial<T>);
        }
      }}
      onKeyDown={(event) => {
        if (!isSalesLineEnterKey(event.key)) return;
        event.preventDefault();
        advanceFromLine(line.key);
      }}
    />
  );
}

export function SalesLineDiscountPctCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
  discountAmountColumn,
  showDiscountAmountSubline = false,
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
  discountAmountColumn?: DocumentColumnPref | null;
  showDiscountAmountSubline?: boolean;
}) {
  const { line, disabled, patchLine, getQuantity, unitPriceField } = ctx;
  const discountType = resolvePoLineDiscountType(line);
  const inputValue = resolvePoLineDiscountInputValue(line);
  const decimalPlaces = resolvePoLineDiscountDecimalPlaces(
    discountType,
    column,
    discountAmountColumn
  );
  const showStack = Boolean(line.variant_id);
  const showAmountPrimary =
    showDiscountAmountSubline && Boolean(discountAmountColumn) && showStack;

  if (!showStack) return null;

  const discountEntryInput = (
    <DocumentLineCompactInput
      align={column.align}
      className={documentFieldTypographyClassName(
        column,
        cn(
          showAmountPrimary ? PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS : DOCUMENT_LINE_COMPACT_INPUT_CLASS,
          showAmountPrimary && "!w-full max-w-full"
        )
      )}
      value={inputValue}
      disabled={disabled}
      inputMode="decimal"
      aria-label={discountType === "amount" ? "Discount amount" : "Discount percent"}
      onChange={(event) => {
        const value = event.target.value;
        patchLine(
          line.key,
          (discountType === "amount"
            ? patchPoLineDiscountAmountInput(line, value)
            : patchPoLineDiscountPercentInput(line, value)) as Partial<T>
        );
      }}
      onBlur={() => {
        const normalized = normalizeDocumentDecimalInput(inputValue, decimalPlaces);
        if (normalized === inputValue) return;
        patchLine(
          line.key,
          (discountType === "amount"
            ? patchPoLineDiscountAmountInput(line, normalized)
            : patchPoLineDiscountPercentInput(line, normalized)) as Partial<T>
        );
      }}
    />
  );

  if (showAmountPrimary && discountAmountColumn) {
    const amountValue = formatSalesLineComputedDiscountAmount(
      line,
      discountAmountColumn,
      getQuantity,
      unitPriceField
    );

    return (
      <PoLineQtyValueStack
        showUnitUnderQty={showStack}
        align={column.align}
        unitSlot={
          <PoLineSublineZone align={column.align}>
            <PoLineSublineRow align={column.align}>
              <div
                className={cn(
                  "flex w-full min-w-0 px-2",
                  column.align === "right" && "justify-end",
                  column.align === "center" && "justify-center"
                )}
              >
                {discountEntryInput}
              </div>
            </PoLineSublineRow>
            <PoLineSublineRow align={column.align}>
              <PoLineDiscountTypeSlot
                type={discountType}
                align={column.align}
                disabled={disabled}
                onTypeChange={(type) =>
                  patchLine(line.key, patchPoLineDiscountType(line, type) as Partial<T>)
                }
              />
            </PoLineSublineRow>
          </PoLineSublineZone>
        }
      >
        <span
          className={documentFieldTypographyClassName(
            column,
            cn(
              DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS,
              column.align === "right" ? "text-right" : "text-left"
            )
          )}
        >
          {amountValue}
        </span>
      </PoLineQtyValueStack>
    );
  }

  return (
    <PoLineQtyValueStack
      showUnitUnderQty={showStack}
      align={column.align}
      unitSlot={
        <PoLineSublineSingleRow align={column.align}>
          <PoLineDiscountTypeSlot
            type={discountType}
            align={column.align}
            disabled={disabled}
            onTypeChange={(type) =>
              patchLine(line.key, patchPoLineDiscountType(line, type) as Partial<T>)
            }
          />
        </PoLineSublineSingleRow>
      }
    >
      {discountEntryInput}
    </PoLineQtyValueStack>
  );
}

export function SalesLineDiscountAmountCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
}) {
  const { line, getQuantity, unitPriceField } = ctx;
  const value = formatSalesLineComputedDiscountAmount(line, column, getQuantity, unitPriceField);

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {value}
    </div>
  );
}

const SALES_LINE_FALLBACK_TAX_RATE_COLUMN: DocumentColumnPref = {
  id: "tax_rate_pct",
  label: "Tax %",
  defaultVisible: false,
  group: "line",
  align: "right",
  decimalPlaces: 2,
  lineSlot: "column",
};

export function SalesLineTaxRateCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
  taxCodeOptions = [],
  compact = false,
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
  compact?: boolean;
}) {
  const { line, disabled, patchLine } = ctx;

  if (!line.variant_id) {
    return null;
  }

  if (!canEditSalesLineTaxRate(line, taxCodeOptions)) {
    const value = resolveSalesDraftLineTaxRateDisplay(line, column);
    return (
      <span
        className={cn(
          "block px-2 tabular-nums text-muted-foreground",
          compact ? PO_LINE_SUBLINE_TEXT_CLASS : "py-1.5 text-sm",
          column.align === "right" && "text-right"
        )}
      >
        {value}
      </span>
    );
  }

  return (
    <PoLineTaxCodeSlot
      line={line as unknown as PoDraftLine}
      taxCodeOptions={taxCodeOptions}
      align={column.align}
      compact={compact}
      disabled={disabled}
      onTaxCodeChange={(taxCodeId) =>
        patchLine(line.key, patchSalesLineTaxCodeSelection(line, taxCodeId, taxCodeOptions) as Partial<T>)
      }
    />
  );
}

export function SalesLineTaxAmountCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
  showTaxRateSubline = false,
  taxRateColumn,
  taxCodeOptions = [],
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
  showTaxRateSubline?: boolean;
  taxRateColumn?: DocumentColumnPref | null;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
}) {
  const { line, quantityField, unitPriceField } = ctx;
  const resolvedTaxRateColumn = taxRateColumn ?? SALES_LINE_FALLBACK_TAX_RATE_COLUMN;
  const value = resolveSalesDraftLineTaxAmountDisplay(
    line,
    column,
    quantityField,
    unitPriceField,
    {
      purchasePricesTaxInclusive: ctx.pricesTaxInclusive,
      taxMechanism: ctx.taxMechanism,
    }
  );
  const showStack = showTaxRateSubline && Boolean(line.variant_id);

  if (!showStack) {
    return (
      <div
        className={documentFieldTypographyClassName(
          column,
          cn(
            DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
            column.align === "right" ? "text-right" : "text-left"
          )
        )}
      >
        {value}
      </div>
    );
  }

  return (
    <PoLineQtyValueStack
      showUnitUnderQty
      align={column.align}
      unitSlot={
        <PoLineSublineSingleRow align={column.align}>
          <SalesLineTaxRateCell
            ctx={ctx}
            column={resolvedTaxRateColumn}
            taxCodeOptions={taxCodeOptions}
            compact
          />
        </PoLineSublineSingleRow>
      }
    >
      <span
        className={documentFieldTypographyClassName(
          column,
          cn(
            DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS,
            column.align === "right" ? "text-right" : "text-left"
          )
        )}
      >
        {value}
      </span>
    </PoLineQtyValueStack>
  );
}

export function SalesLineTotalCell<T extends SalesCommerceLineBase>({
  ctx,
  column,
}: {
  ctx: SalesLineCellContext<T>;
  column: DocumentColumnPref;
}) {
  const { line, quantityField, unitPriceField } = ctx;
  const decimalPlaces = resolveColumnDecimalPlaces(column);
  const taxOptions = {
    purchasePricesTaxInclusive: ctx.pricesTaxInclusive,
    taxMechanism: ctx.taxMechanism,
  };

  if (!line.variant_id) {
    return (
      <div
        className={documentFieldTypographyClassName(
          column,
          cn(
            DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
            column.align === "right" ? "text-right" : "text-left"
          )
        )}
      >
        —
      </div>
    );
  }

  const resolved = resolveSalesDraftLineTaxAmount(
    line,
    quantityField,
    unitPriceField,
    taxOptions
  );
  const showStack = shouldShowPoLineTotalExTaxSubline(line, {
    taxRate: line.catalog_context?.tax_rate ?? 0,
    taxAmount: resolved.taxAmount,
  });
  const primaryAmount = resolvePoLineTotalPrimaryAmount(resolved, showStack);
  const primaryValue = formatPoMoney(primaryAmount, decimalPlaces);
  const exTaxValue = formatPoMoney(resolved.taxableBase, decimalPlaces);

  if (!showStack) {
    return (
      <div
        className={documentFieldTypographyClassName(
          column,
          cn(
            DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
            column.align === "right" ? "text-right" : "text-left"
          )
        )}
      >
        {primaryValue}
      </div>
    );
  }

  return (
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
                column.align === "right" && "text-right"
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
                column.align === "right" && "text-right"
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
          cn(
            DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS,
            column.align === "right" ? "text-right" : "text-left"
          )
        )}
      >
        {primaryValue}
      </span>
    </PoLineQtyValueStack>
  );
}

export type SalesLineEntryLayoutOptions = {
  showUnitUnderQty: boolean;
  discountAmountColumn?: DocumentColumnPref | null;
  showDiscountAmountUnderPct?: boolean;
  taxRateColumn?: DocumentColumnPref | null;
  showTaxRateUnderLineTax?: boolean;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
};

export function renderSalesLineColumnCell<T extends SalesCommerceLineBase>(
  columnId: string,
  column: DocumentColumnPref,
  ctx: SalesLineCellContext<T>,
  nestedColumns: DocumentColumnPref[],
  imageDisplayMode: DocumentImageDisplayMode,
  layoutOptions: SalesLineEntryLayoutOptions
) {
  const {
    showUnitUnderQty,
    discountAmountColumn,
    showDiscountAmountUnderPct = false,
    taxRateColumn,
    showTaxRateUnderLineTax = false,
    taxCodeOptions = [],
  } = layoutOptions;

  if (columnId === SALES_LINE_IMAGE_COLUMN_ID) {
    return <SalesLineImageCell line={ctx.line} />;
  }
  if (columnId === "item") {
    return (
      <SalesLineItemCell
        ctx={ctx}
        nestedColumns={nestedColumns}
        itemColumn={column}
        imageDisplayMode={imageDisplayMode}
      />
    );
  }
  if (columnId === "quantity_ordered") {
    return <SalesLineQtyCell ctx={ctx} column={column} showUnitUnderQty={showUnitUnderQty} />;
  }
  if (columnId === "unit") {
    return <SalesLineUnitCell ctx={ctx} column={column} />;
  }
  if (columnId === "unit_price") {
    return <SalesLinePriceCell ctx={ctx} column={column} />;
  }
  if (columnId === "discount_pct") {
    return (
      <SalesLineDiscountPctCell
        ctx={ctx}
        column={column}
        discountAmountColumn={discountAmountColumn}
        showDiscountAmountSubline={showDiscountAmountUnderPct}
      />
    );
  }
  if (columnId === "discount_amount") {
    return <SalesLineDiscountAmountCell ctx={ctx} column={column} />;
  }
  if (columnId === "tax_rate_pct") {
    return (
      <SalesLineTaxRateCell ctx={ctx} column={column} taxCodeOptions={taxCodeOptions} />
    );
  }
  if (columnId === "line_tax_amount") {
    return (
      <SalesLineTaxAmountCell
        ctx={ctx}
        column={column}
        showTaxRateSubline={showTaxRateUnderLineTax}
        taxRateColumn={taxRateColumn}
        taxCodeOptions={taxCodeOptions}
      />
    );
  }
  if (columnId === "line_total") {
    return <SalesLineTotalCell ctx={ctx} column={column} />;
  }

  const nestedValue = resolveNestedFieldDisplay(column, ctx.line);
  if (nestedValue == null) return null;

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
          column.id === "sku" && "font-mono tabular-nums",
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {nestedValue}
    </div>
  );
}

export { resolvePoUnitPriceColumnLabelFromLayout };
