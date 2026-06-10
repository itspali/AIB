"use client";

import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import {
  DOCUMENT_LINE_COMPACT_INPUT_CLASS,
  DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS,
  DocumentLineCompactInput,
  DocumentLineRemoveButton,
} from "@/components/documents/document-line-entry-cells";
import { DocumentLineImage } from "@/components/documents/document-line-image";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import {
  normalizeDocumentDecimalInput,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import { cn } from "@/lib/utils";
import { isCatalogFieldId } from "@/lib/documents/catalog-field-ids";
import { resolveCommercialLineDetailDisplay } from "@/lib/documents/line-detail-display";
import { resolveLineDetailFieldDisplay } from "@/lib/documents/catalog-line-values";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import type { DocumentColumnPref, DocumentImageDisplayMode } from "@/lib/documents/types";
import {
  PO_LINE_IMAGE_COLUMN_ID,
  shouldShowPoLineInlineImage,
} from "@/lib/documents/purchase-order-layout";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import {
  resolvePoDraftLineTaxAmountDisplay,
  resolvePoDraftLineTaxRateDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax";
import {
  resolvePoDraftLineCgstAmountDisplay,
  resolvePoDraftLineIgstAmountDisplay,
  resolvePoDraftLineSgstAmountDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax-components";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import {
  formatPoMoney,
  resolvePoLineTaxAmount,
} from "@/lib/procurement/purchase-orders/totals";
import {
  resolvePoUnitPriceAriaLabel,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { isEnterKey } from "@/components/procurement/purchase-orders/po-line-entry-actions";
import { PoLineSupplierInsightsButton } from "@/components/procurement/purchase-orders/po-line-supplier-insights";
import {
  PoLineQtyUnitSlot,
  PoLineQtyValueStack,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { PoLineDiscountTypeSlot } from "@/components/procurement/purchase-orders/po-line-discount-type-slot";
import {
  canEditPoLineUom,
  formatPoLineUomConversionHint,
  resolvePoDraftLineUnitCode,
  resolvePoLineUomOptions,
} from "@/lib/procurement/purchase-orders/po-line-unit";
import {
  formatPoLineComputedDiscountAmount,
  patchPoLineDiscountAmountInput,
  patchPoLineDiscountPercentInput,
  patchPoLineDiscountType,
  resolvePoLineDiscountDecimalPlaces,
  resolvePoLineDiscountInputValue,
  resolvePoLineDiscountType,
} from "@/lib/procurement/purchase-orders/po-line-discount";
import { PoLineMrpMarkdownSlot } from "@/components/procurement/purchase-orders/po-line-mrp-markdown-slot";
import {
  patchPoLineMrpMarkdownPercentage,
  patchPoLineMrpMarkdownPercentageDraft,
  patchPoLineOfferUnitPrice,
  patchPoLineOfferUnitPriceDraft,
  shouldShowPoMrpTradeTermsStack,
  syncPoLineMrpMarkdownFromOfferPrice,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";

export const PO_LINE_COMPACT_INPUT_CLASS = DOCUMENT_LINE_COMPACT_INPUT_CLASS;
export const PO_LINE_ITEM_CELL_INPUT_CLASS = DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS;

type LineCellContext = {
  line: PoDraftLine;
  disabled: boolean;
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  enableMrpTradeTerms?: boolean;
  pricesTaxInclusive?: boolean;
  taxSupplyNature?: PoTaxSupplyNature;
  /** MRP rendered as its own table column — suppress duplicate reference under offer price. */
  mrpColumnVisible?: boolean;
  itemRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>;
  qtyRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  priceRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  patchLine: (key: string, patch: Partial<PoDraftLine>) => void;
  bindItemChange: (lineKey: string) => (patch: Partial<PoDraftLine>) => void;
  focusPrice: (lineKey: string) => void;
  advanceFromLine: (lineKey: string) => void;
};

function resolveNestedFieldDisplay(
  column: DocumentColumnPref,
  line: PoDraftLine,
  pricesTaxInclusive = false,
  taxSupplyNature: PoTaxSupplyNature = "INTERSTATE"
): string | null {
  const commercial = resolveCommercialLineDetailDisplay(column, line, {
    purchasePricesTaxInclusive: pricesTaxInclusive,
    taxSupplyNature,
  });
  return resolveLineDetailFieldDisplay(column, line.catalog_context, commercial);
}

function visibleNestedColumns(
  columns: DocumentColumnPref[],
  line: PoDraftLine,
  pricesTaxInclusive = false,
  taxSupplyNature: PoTaxSupplyNature = "INTERSTATE"
): DocumentColumnPref[] {
  return columns.filter((column) => {
    const value = resolveNestedFieldDisplay(column, line, pricesTaxInclusive, taxSupplyNature);
    return value != null && value !== "";
  });
}

function resolveLineImageUrl(line: PoDraftLine): string | null {
  return line.catalog_context?.image_url ?? null;
}

function isSkuLineFieldVisible(columns: DocumentColumnPref[]): boolean {
  return columns.some((column) => column.id === "sku" && column.defaultVisible);
}

export function PoLineNestedUnderItemFields({
  line,
  nestedColumns,
  pricesTaxInclusive = false,
  taxSupplyNature = "INTERSTATE",
}: {
  line: PoDraftLine;
  nestedColumns: DocumentColumnPref[];
  pricesTaxInclusive?: boolean;
  taxSupplyNature?: PoTaxSupplyNature;
}) {
  if (!line.variant_id || nestedColumns.length === 0) return null;

  const columnsToRender = visibleNestedColumns(
    nestedColumns,
    line,
    pricesTaxInclusive,
    taxSupplyNature
  );
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
              const displayValue = resolveNestedFieldDisplay(
                column,
                line,
                pricesTaxInclusive,
                taxSupplyNature
              );
              if (!displayValue) return null;
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
                </span>
              );
            })}
          </div>
        ) : (
          (() => {
            const column = rowColumns[0]!;
            const displayValue = resolveNestedFieldDisplay(
              column,
              line,
              pricesTaxInclusive,
              taxSupplyNature
            );
            if (!displayValue) return null;
            return (
              <div
                key={column.id}
                className={documentFieldTypographyClassName(
                  column,
                  "flex min-w-0 items-baseline gap-1 text-xs leading-snug text-muted-foreground"
                )}
              >
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
              </div>
            );
          })()
        )
      )}
    </div>
  );
}

export function PoLineImageCell({ line }: { line: PoDraftLine }) {
  return (
    <div className="flex items-center justify-center px-1 py-2">
      <DocumentLineImage imageUrl={resolveLineImageUrl(line)} />
    </div>
  );
}

export function PoLineItemCell({
  ctx,
  nestedColumns,
  itemColumn,
  imageDisplayMode,
}: {
  ctx: LineCellContext;
  nestedColumns: DocumentColumnPref[];
  itemColumn: DocumentColumnPref;
  imageDisplayMode: DocumentImageDisplayMode;
}) {
  const { line, disabled, supplierId, destinationLocationId, excludePurchaseOrderId, itemRefs, bindItemChange, patchLine } =
    ctx;

  const pricesTaxInclusive = ctx.pricesTaxInclusive ?? false;
  const taxSupplyNature = ctx.taxSupplyNature ?? "INTERSTATE";

  const skuLineFieldVisible = isSkuLineFieldVisible(nestedColumns);
  const showSkuFallback =
    Boolean(line.variant_sku) &&
    !skuLineFieldVisible &&
    !visibleNestedColumns(nestedColumns, line, pricesTaxInclusive, taxSupplyNature).some((column) =>
      isCatalogFieldId(column.id)
    );

  const hideFieldSecondary =
    nestedColumns.length > 0 &&
    Boolean(line.variant_id) &&
    (skuLineFieldVisible ||
      visibleNestedColumns(nestedColumns, line, pricesTaxInclusive, taxSupplyNature).length > 0 ||
      showSkuFallback);

  const showInlineImage = shouldShowPoLineInlineImage(imageDisplayMode);

  return (
    <div className="min-w-0 px-2 py-2 text-sm">
      <div className="flex min-w-0 items-start gap-2">
        {showInlineImage ? (
          <DocumentLineImage imageUrl={resolveLineImageUrl(line)} className="mt-0.5" />
        ) : null}
        <div className="flex min-w-0 flex-1 items-start gap-1">
          <div className="min-w-0 flex-1">
            <StockVariantSkuField
              compact
              displayMode="item"
              wrapSelectedItemName
              disabled={disabled}
              inputClassName={documentFieldTypographyClassName(
                itemColumn,
                cn(PO_LINE_ITEM_CELL_INPUT_CLASS, "font-medium")
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
                unit_cost: line.unit_price_contractual || "0",
                skuError: line.skuError,
              }}
              onChange={bindItemChange(line.key)}
            />
          </div>
          <PoLineSupplierInsightsButton
            line={line}
            supplierId={supplierId}
            destinationLocationId={destinationLocationId}
            excludePurchaseOrderId={excludePurchaseOrderId}
            disabled={disabled}
            onApplyCatalogPrice={(lineKey, price) => {
              const sync = syncPoLineMrpMarkdownFromOfferPrice({
                ...line,
                unit_price_contractual: price,
              });
              patchLine(lineKey, {
                unit_price_contractual: price,
                ...(sync ?? {}),
              });
            }}
          />
        </div>
      </div>
      <PoLineNestedUnderItemFields
        line={line}
        nestedColumns={nestedColumns}
        pricesTaxInclusive={pricesTaxInclusive}
        taxSupplyNature={taxSupplyNature}
      />
    </div>
  );
}

export function PoLineUnitCell({
  ctx,
  column,
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
}) {
  const { line, disabled, patchLine } = ctx;
  const unitCode = line.variant_id ? resolvePoDraftLineUnitCode(line) : null;
  const uomOptions = resolvePoLineUomOptions(line).map((option) => option.uom_code);
  const conversionHint = line.variant_id ? formatPoLineUomConversionHint(line) : null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col py-0.5",
        column.align === "right" && "items-end"
      )}
    >
      <PoLineQtyUnitSlot
        unitCode={unitCode}
        align={column.align}
        editable={line.variant_id ? canEditPoLineUom(line) : false}
        disabled={disabled}
        unitOptions={uomOptions}
        onUnitChange={(code) => patchLine(line.key, { uom_code: code })}
        conversionHint={conversionHint}
        className="w-full text-sm leading-snug"
      />
    </div>
  );
}

export function PoLineQtyCell({
  ctx,
  column,
  showUnitUnderQty,
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
  showUnitUnderQty: boolean;
}) {
  const { line, disabled, qtyRefs, patchLine, focusPrice } = ctx;
  const decimalPlaces = resolveColumnDecimalPlaces(column);
  const unitCode =
    showUnitUnderQty && line.variant_id ? resolvePoDraftLineUnitCode(line) : null;
  const uomOptions = resolvePoLineUomOptions(line).map((option) => option.uom_code);
  const editableUom = line.variant_id && canEditPoLineUom(line);
  const conversionHint =
    showUnitUnderQty && line.variant_id ? formatPoLineUomConversionHint(line) : null;
  const showQtyStack = showUnitUnderQty && Boolean(line.variant_id);

  const qtyInput = (
    <DocumentLineCompactInput
      ref={(node) => {
        qtyRefs.current[line.key] = node;
      }}
      align={column.align}
      className={documentFieldTypographyClassName(column, DOCUMENT_LINE_COMPACT_INPUT_CLASS)}
      value={line.quantity_ordered}
      disabled={disabled}
      inputMode="decimal"
      aria-label="Quantity ordered"
      onChange={(event) => patchLine(line.key, { quantity_ordered: event.target.value })}
      onBlur={() => {
        const normalized = normalizeDocumentDecimalInput(
          line.quantity_ordered,
          decimalPlaces
        );
        if (normalized !== line.quantity_ordered) {
          patchLine(line.key, { quantity_ordered: normalized });
        }
      }}
      onKeyDown={(event) => {
        if (!isEnterKey(event.key)) return;
        event.preventDefault();
        if (line.variant_id && Number(line.quantity_ordered) > 0) {
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
          onUnitChange={(code) => patchLine(line.key, { uom_code: code })}
          conversionHint={conversionHint}
          className="w-full"
        />
      }
    >
      {qtyInput}
    </PoLineQtyValueStack>
  );
}

export function PoLinePriceCell({
  ctx,
  column,
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
}) {
  const {
    line,
    disabled,
    priceRefs,
    patchLine,
    advanceFromLine,
    enableMrpTradeTerms = true,
    mrpColumnVisible = false,
    pricesTaxInclusive = false,
  } = ctx;
  const showMrpStack = shouldShowPoMrpTradeTermsStack(line, enableMrpTradeTerms);

  const priceInput = (
    <DocumentLineCompactInput
      ref={(node) => {
        priceRefs.current[line.key] = node;
      }}
      align={column.align}
      className={documentFieldTypographyClassName(column, DOCUMENT_LINE_COMPACT_INPUT_CLASS)}
      value={line.unit_price_contractual}
      disabled={disabled}
      inputMode="decimal"
      aria-label={resolvePoUnitPriceAriaLabel(pricesTaxInclusive)}
      onChange={(event) =>
        patchLine(line.key, patchPoLineOfferUnitPriceDraft(line, event.target.value))
      }
      onBlur={() => {
        const normalized = patchPoLineOfferUnitPrice(
          line,
          line.unit_price_contractual,
          column
        );
        if (
          normalized.unit_price_contractual !== line.unit_price_contractual ||
          normalized.mrp_markdown_percentage !== line.mrp_markdown_percentage
        ) {
          patchLine(line.key, normalized);
        }
      }}
      onKeyDown={(event) => {
        if (!isEnterKey(event.key)) return;
        event.preventDefault();
        advanceFromLine(line.key);
      }}
    />
  );

  if (!showMrpStack) {
    return priceInput;
  }

  return (
    <PoLineQtyValueStack
      showUnitUnderQty
      align={column.align}
      className="min-w-0 w-full max-w-full"
      unitSlot={
        <PoLineMrpMarkdownSlot
          line={line}
          column={column}
          disabled={disabled}
          showMrpReference={!mrpColumnVisible}
          onMarkdownChange={(markdownPct) =>
            patchLine(
              line.key,
              patchPoLineMrpMarkdownPercentageDraft(line, markdownPct, column)
            )
          }
          onMarkdownBlur={(markdownPct) =>
            patchLine(line.key, patchPoLineMrpMarkdownPercentage(line, markdownPct, column))
          }
        />
      }
    >
      {priceInput}
    </PoLineQtyValueStack>
  );
}

export function PoLineDiscountPctCell({
  ctx,
  column,
  discountAmountColumn,
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
  discountAmountColumn?: DocumentColumnPref | null;
}) {
  const { line, disabled, patchLine } = ctx;
  const discountType = resolvePoLineDiscountType(line);
  const inputValue = resolvePoLineDiscountInputValue(line);
  const decimalPlaces = resolvePoLineDiscountDecimalPlaces(
    discountType,
    column,
    discountAmountColumn
  );
  const showStack = Boolean(line.variant_id);
  const ariaLabel = discountType === "amount" ? "Discount amount" : "Discount percent";

  if (!showStack) {
    return null;
  }

  return (
    <PoLineQtyValueStack
      showUnitUnderQty={showStack}
      align={column.align}
      unitSlot={
        <PoLineDiscountTypeSlot
          type={discountType}
          align={column.align}
          disabled={disabled}
          onTypeChange={(type) => patchLine(line.key, patchPoLineDiscountType(line, type))}
        />
      }
    >
      <DocumentLineCompactInput
        align={column.align}
        className={documentFieldTypographyClassName(column, DOCUMENT_LINE_COMPACT_INPUT_CLASS)}
        value={inputValue}
        disabled={disabled}
        inputMode="decimal"
        aria-label={ariaLabel}
        onChange={(event) => {
          const value = event.target.value;
          patchLine(
            line.key,
            discountType === "amount"
              ? patchPoLineDiscountAmountInput(line, value)
              : patchPoLineDiscountPercentInput(line, value)
          );
        }}
        onBlur={() => {
          const normalized = normalizeDocumentDecimalInput(inputValue, decimalPlaces);
          if (normalized === inputValue) return;
          patchLine(
            line.key,
            discountType === "amount"
              ? patchPoLineDiscountAmountInput(line, normalized)
              : patchPoLineDiscountPercentInput(line, normalized)
          );
        }}
      />
    </PoLineQtyValueStack>
  );
}

export function PoLineDiscountAmountCell({
  ctx,
  column,
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
}) {
  const { line } = ctx;
  const value = formatPoLineComputedDiscountAmount(line, column);

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {value}
    </div>
  );
}

export function PoLineTaxRateCell({
  line,
  column,
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
}) {
  const value = resolvePoDraftLineTaxRateDisplay(line, column);

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {value}
    </div>
  );
}

export function PoLineTaxAmountCell({
  line,
  column,
  pricesTaxInclusive = false,
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
  pricesTaxInclusive?: boolean;
}) {
  const value = resolvePoDraftLineTaxAmountDisplay(line, column, {
    purchasePricesTaxInclusive: pricesTaxInclusive,
  });

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {value}
    </div>
  );
}

export function PoLineTaxComponentAmountCell({
  line,
  column,
  pricesTaxInclusive = false,
  taxSupplyNature = "INTERSTATE",
  resolveDisplay,
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
  pricesTaxInclusive?: boolean;
  taxSupplyNature?: PoTaxSupplyNature;
  resolveDisplay: (
    line: PoDraftLine,
    column: DocumentColumnPref,
    options: { purchasePricesTaxInclusive: boolean; taxSupplyNature: PoTaxSupplyNature }
  ) => string;
}) {
  const value = resolveDisplay(line, column, {
    purchasePricesTaxInclusive: pricesTaxInclusive,
    taxSupplyNature,
  });

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {value}
    </div>
  );
}

export function PoLineTotalCell({
  line,
  column,
  pricesTaxInclusive = false,
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
  pricesTaxInclusive?: boolean;
}) {
  const lineTotal = formatPoMoney(
    resolvePoLineTaxAmount(line, { purchasePricesTaxInclusive: pricesTaxInclusive }).taxableBase,
    resolveColumnDecimalPlaces(column)
  );

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {lineTotal}
    </div>
  );
}

export function PoLineReadOnlyCell({
  line,
  column,
  pricesTaxInclusive = false,
  taxSupplyNature = "INTERSTATE",
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
  pricesTaxInclusive?: boolean;
  taxSupplyNature?: PoTaxSupplyNature;
}) {
  const value =
    resolveNestedFieldDisplay(column, line, pricesTaxInclusive, taxSupplyNature) ?? "—";

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn(
          "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
          column.id === "sku" && "font-mono tabular-nums",
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {value}
    </div>
  );
}

export const PoLineRemoveButton = DocumentLineRemoveButton;

export function renderPoLineColumnCell(
  columnId: string,
  column: DocumentColumnPref,
  ctx: LineCellContext,
  nestedColumns: DocumentColumnPref[],
  imageDisplayMode: DocumentImageDisplayMode,
  showUnitUnderQty: boolean,
  discountAmountColumn?: DocumentColumnPref | null
) {
  if (columnId === PO_LINE_IMAGE_COLUMN_ID) {
    return <PoLineImageCell line={ctx.line} />;
  }
  if (columnId === "item") {
    return (
      <PoLineItemCell
        ctx={ctx}
        nestedColumns={nestedColumns}
        itemColumn={column}
        imageDisplayMode={imageDisplayMode}
      />
    );
  }
  if (columnId === "quantity_ordered") {
    return (
      <PoLineQtyCell ctx={ctx} column={column} showUnitUnderQty={showUnitUnderQty} />
    );
  }
  if (columnId === "unit") {
    return <PoLineUnitCell ctx={ctx} column={column} />;
  }
  if (columnId === "unit_price") {
    return <PoLinePriceCell ctx={ctx} column={column} />;
  }
  if (columnId === "discount_pct") {
    return (
      <PoLineDiscountPctCell
        ctx={ctx}
        column={column}
        discountAmountColumn={discountAmountColumn}
      />
    );
  }
  if (columnId === "discount_amount") {
    return <PoLineDiscountAmountCell ctx={ctx} column={column} />;
  }
  if (columnId === "tax_rate_pct") {
    return <PoLineTaxRateCell line={ctx.line} column={column} />;
  }
  if (columnId === "line_tax_amount") {
    return (
      <PoLineTaxAmountCell
        line={ctx.line}
        column={column}
        pricesTaxInclusive={ctx.pricesTaxInclusive}
      />
    );
  }
  if (columnId === "cgst_amount") {
    return (
      <PoLineTaxComponentAmountCell
        line={ctx.line}
        column={column}
        pricesTaxInclusive={ctx.pricesTaxInclusive}
        taxSupplyNature={ctx.taxSupplyNature}
        resolveDisplay={resolvePoDraftLineCgstAmountDisplay}
      />
    );
  }
  if (columnId === "sgst_amount") {
    return (
      <PoLineTaxComponentAmountCell
        line={ctx.line}
        column={column}
        pricesTaxInclusive={ctx.pricesTaxInclusive}
        taxSupplyNature={ctx.taxSupplyNature}
        resolveDisplay={resolvePoDraftLineSgstAmountDisplay}
      />
    );
  }
  if (columnId === "igst_amount") {
    return (
      <PoLineTaxComponentAmountCell
        line={ctx.line}
        column={column}
        pricesTaxInclusive={ctx.pricesTaxInclusive}
        taxSupplyNature={ctx.taxSupplyNature}
        resolveDisplay={resolvePoDraftLineIgstAmountDisplay}
      />
    );
  }
  if (columnId === "line_total") {
    return (
      <PoLineTotalCell
        line={ctx.line}
        column={column}
        pricesTaxInclusive={ctx.pricesTaxInclusive}
      />
    );
  }
  return (
    <PoLineReadOnlyCell
      line={ctx.line}
      column={column}
      pricesTaxInclusive={ctx.pricesTaxInclusive}
      taxSupplyNature={ctx.taxSupplyNature}
    />
  );
}

export type { LineCellContext };
