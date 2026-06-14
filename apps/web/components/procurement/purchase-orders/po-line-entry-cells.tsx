"use client";

import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import {
  DOCUMENT_LINE_COMPACT_INPUT_CLASS,
  DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
  DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS,
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
  canEditPoLineTaxRate,
  resolvePoDraftLineTaxAmountDisplay,
  resolvePoDraftLineTaxRateDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax";
import { patchPoLineTaxCodeSelection } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import { PoLineTaxCodeSlot } from "@/components/procurement/purchase-orders/po-line-tax-code-slot";
import {
  resolvePoDraftLineCgstAmountDisplay,
  resolvePoDraftLineIgstAmountDisplay,
  resolvePoDraftLineSgstAmountDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax-components";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import {
  formatPoMoney,
  resolvePoLineTaxAmount,
} from "@/lib/procurement/purchase-orders/totals";
import {
  resolvePoLineTotalPrimaryAmount,
  resolvePoUnitPriceAriaLabel,
  shouldShowPoLineTotalExTaxSubline,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { isEnterKey } from "@/components/procurement/purchase-orders/po-line-entry-actions";
import { PoLineSupplierInsightsButton } from "@/components/procurement/purchase-orders/po-line-supplier-insights";
import {
  PO_LINE_SUBLINE_TEXT_CLASS,
  PoLineQtyUnitSlot,
  PoLineQtyValueStack,
  PoLineSublineRow,
  PoLineSublineSingleRow,
  PoLineSublineZone,
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
import { PoLinePromoSlot } from "@/components/procurement/purchase-orders/po-line-promo-slot";
import {
  patchPoLineMrpReference,
  patchPoLineMrpReferenceDraft,
  PoLineMrpReferenceSlot,
} from "@/components/procurement/purchase-orders/po-line-mrp-reference-slot";
import { isPromotionalPoLine } from "@/lib/procurement/purchase-orders/po-promo";
import {
  PO_HSN_CATALOG_FIELD_ID,
} from "@/lib/procurement/purchase-orders/po-gst-compliance";
import { PoLineHsnSacSlot } from "@/components/procurement/purchase-orders/po-line-hsn-slot";
import {
  formatPoLineMrpReference,
  hasPoLineMrpOverride,
  resolvePoLineMrpFromCatalog,
  patchPoLineOfferUnitPrice,
  patchPoLineOfferUnitPriceDraft,
  syncPoLineMrpMarkdownFromOfferPrice,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import { resolvePoLinePickerOfferUnitPrice } from "@/lib/procurement/purchase-orders/supplier-price";

export const PO_LINE_COMPACT_INPUT_CLASS = DOCUMENT_LINE_COMPACT_INPUT_CLASS;
export const PO_LINE_ITEM_CELL_INPUT_CLASS = DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS;

type LineCellContext = {
  line: PoDraftLine;
  lines: PoDraftLine[];
  promoDefaultCategory: string;
  disabled: boolean;
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  enableMrpTradeTerms?: boolean;
  pricesTaxInclusive?: boolean;
  taxSupplyNature?: PoTaxSupplyNature;
  taxMechanism?: GstTaxMechanism;
  gstRegistered?: boolean;
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
  taxSupplyNature: PoTaxSupplyNature = "INTERSTATE",
  gstRegistered = false
): DocumentColumnPref[] {
  const filtered = columns.filter((column) => {
    if (gstRegistered && column.id === PO_HSN_CATALOG_FIELD_ID && line.variant_id) {
      return true;
    }
    const value = resolveNestedFieldDisplay(column, line, pricesTaxInclusive, taxSupplyNature);
    return value != null && value !== "";
  });

  if (
    gstRegistered &&
    line.variant_id &&
    !filtered.some((column) => column.id === PO_HSN_CATALOG_FIELD_ID)
  ) {
    const hsnColumn = columns.find((column) => column.id === PO_HSN_CATALOG_FIELD_ID);
    if (hsnColumn) filtered.push(hsnColumn);
  }

  return filtered;
}

function renderNestedFieldContent({
  column,
  line,
  pricesTaxInclusive,
  taxSupplyNature,
  gstRegistered,
  disabled,
  patchLine,
}: {
  column: DocumentColumnPref;
  line: PoDraftLine;
  pricesTaxInclusive: boolean;
  taxSupplyNature: PoTaxSupplyNature;
  gstRegistered: boolean;
  disabled?: boolean;
  patchLine?: (key: string, patch: Partial<PoDraftLine>) => void;
}) {
  if (gstRegistered && column.id === PO_HSN_CATALOG_FIELD_ID && patchLine) {
    return (
      <PoLineHsnSacSlot
        line={line}
        column={column}
        disabled={disabled}
        onPatch={(patch) => patchLine(line.key, patch)}
      />
    );
  }

  const displayValue = resolveNestedFieldDisplay(
    column,
    line,
    pricesTaxInclusive,
    taxSupplyNature
  );
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
  gstRegistered = false,
  disabled = false,
  patchLine,
}: {
  line: PoDraftLine;
  nestedColumns: DocumentColumnPref[];
  pricesTaxInclusive?: boolean;
  taxSupplyNature?: PoTaxSupplyNature;
  gstRegistered?: boolean;
  disabled?: boolean;
  patchLine?: (key: string, patch: Partial<PoDraftLine>) => void;
}) {
  if (!line.variant_id || nestedColumns.length === 0) return null;

  const columnsToRender = visibleNestedColumns(
    nestedColumns,
    line,
    pricesTaxInclusive,
    taxSupplyNature,
    gstRegistered
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
              const content = renderNestedFieldContent({
                column,
                line,
                pricesTaxInclusive,
                taxSupplyNature,
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
              pricesTaxInclusive,
              taxSupplyNature,
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
  const gstRegistered = ctx.gstRegistered ?? false;

  const skuLineFieldVisible = isSkuLineFieldVisible(nestedColumns);
  const showSkuFallback =
    Boolean(line.variant_sku) &&
    !skuLineFieldVisible &&
    !visibleNestedColumns(nestedColumns, line, pricesTaxInclusive, taxSupplyNature, gstRegistered).some(
      (column) => isCatalogFieldId(column.id)
    );

  const hideFieldSecondary =
    nestedColumns.length > 0 &&
    Boolean(line.variant_id) &&
    (skuLineFieldVisible ||
      visibleNestedColumns(
        nestedColumns,
        line,
        pricesTaxInclusive,
        taxSupplyNature,
        gstRegistered
      ).length > 0 ||
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
              const normalizedPrice = resolvePoLinePickerOfferUnitPrice(price);
              const sync = syncPoLineMrpMarkdownFromOfferPrice(
                {
                  ...line,
                  unit_price_contractual: normalizedPrice,
                },
                pricesTaxInclusive
              );
              patchLine(lineKey, {
                unit_price_contractual: normalizedPrice,
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
        gstRegistered={gstRegistered}
        disabled={disabled}
        patchLine={patchLine}
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
    pricesTaxInclusive = false,
  } = ctx;
  const isPromoLine = isPromotionalPoLine(line) && Boolean(line.variant_id);

  const promoSubline = isPromoLine ? (
    <PoLinePromoSlot
      line={line}
      lines={ctx.lines}
      defaultCategory={ctx.promoDefaultCategory}
      disabled={disabled}
      align={column.align}
      onPatch={(patch) => patchLine(line.key, patch)}
    />
  ) : null;

  const sublineSlot = promoSubline;
  const showSublineStack = Boolean(sublineSlot);

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
        patchLine(line.key, patchPoLineOfferUnitPriceDraft(line, event.target.value, pricesTaxInclusive))
      }
      onBlur={() => {
        const normalized = patchPoLineOfferUnitPrice(
          line,
          line.unit_price_contractual,
          column,
          pricesTaxInclusive
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

  if (!showSublineStack) {
    return priceInput;
  }

  return (
    <div className={cn(isPromoLine && "min-w-0 max-w-full overflow-hidden")}>
      <PoLineQtyValueStack
        showUnitUnderQty
        align={column.align}
        unitSlot={sublineSlot}
        unitSlotClassName={isPromoLine ? "min-w-0 max-w-full overflow-hidden" : undefined}
      >
        {priceInput}
      </PoLineQtyValueStack>
    </div>
  );
}

export function PoLineMrpCell({
  ctx,
  column,
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
}) {
  const { line, disabled, patchLine, enableMrpTradeTerms = true, pricesTaxInclusive = false } = ctx;

  if (!line.variant_id || !enableMrpTradeTerms) {
    return (
      <PoLineReadOnlyCell
        line={line}
        column={column}
        pricesTaxInclusive={ctx.pricesTaxInclusive}
        taxSupplyNature={ctx.taxSupplyNature}
      />
    );
  }

  const catalogMrp = resolvePoLineMrpFromCatalog(line);
  const decimalPlaces = resolveColumnDecimalPlaces(column);

  return (
    <div className="min-w-0 px-2 py-1">
      {catalogMrp > 0 && hasPoLineMrpOverride(line) ? (
        <div className="mb-0.5 truncate text-[10px] leading-tight text-muted-foreground">
          Cat. {formatPoLineMrpReference(catalogMrp, decimalPlaces)}
        </div>
      ) : null}
      <PoLineMrpReferenceSlot
        line={line}
        column={column}
        layout="column"
        disabled={disabled}
        onChange={(value) =>
          patchLine(line.key, patchPoLineMrpReferenceDraft(line, value, pricesTaxInclusive))
        }
        onBlur={(value) =>
          patchLine(line.key, patchPoLineMrpReference(line, value, column, pricesTaxInclusive))
        }
      />
    </div>
  );
}

function PoLineDiscountAmountSubline({
  line,
  column,
  align,
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
  align?: DocumentColumnPref["align"];
}) {
  const value = formatPoLineComputedDiscountAmount(line, column);

  return (
    <span
      className={cn(
        "w-full truncate px-2 tabular-nums",
        PO_LINE_SUBLINE_TEXT_CLASS,
        align === "right" && "text-right"
      )}
    >
      {value}
    </span>
  );
}

export function PoLineDiscountPctCell({
  ctx,
  column,
  discountAmountColumn,
  showDiscountAmountSubline = false,
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
  discountAmountColumn?: DocumentColumnPref | null;
  showDiscountAmountSubline?: boolean;
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
  const showAmountSubline =
    showDiscountAmountSubline && Boolean(discountAmountColumn) && showStack;
  const ariaLabel = discountType === "amount" ? "Discount amount" : "Discount percent";

  if (!showStack) {
    return null;
  }

  return (
    <PoLineQtyValueStack
      showUnitUnderQty={showStack}
      align={column.align}
      unitSlot={
        showAmountSubline && discountAmountColumn ? (
          <PoLineSublineZone align={column.align}>
            <PoLineSublineRow align={column.align}>
              <PoLineDiscountTypeSlot
                type={discountType}
                align={column.align}
                disabled={disabled}
                onTypeChange={(type) =>
                  patchLine(line.key, patchPoLineDiscountType(line, type))
                }
              />
            </PoLineSublineRow>
            <PoLineSublineRow align={column.align}>
              <PoLineDiscountAmountSubline
                line={line}
                column={discountAmountColumn}
                align={column.align}
              />
            </PoLineSublineRow>
          </PoLineSublineZone>
        ) : (
          <PoLineSublineSingleRow align={column.align}>
            <PoLineDiscountTypeSlot
              type={discountType}
              align={column.align}
              disabled={disabled}
              onTypeChange={(type) => patchLine(line.key, patchPoLineDiscountType(line, type))}
            />
          </PoLineSublineSingleRow>
        )
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
          DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
          column.align === "right" ? "text-right" : "text-left"
        )
      )}
    >
      {value}
    </div>
  );
}

function PoLineTaxRateInput({
  line,
  column,
  taxCodeOptions,
  disabled,
  patchLine,
  compact = false,
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
  taxCodeOptions: readonly PoLineTaxCodeOption[];
  disabled: boolean;
  patchLine: LineCellContext["patchLine"];
  compact?: boolean;
}) {
  if (!canEditPoLineTaxRate(line, taxCodeOptions)) {
    const value = resolvePoDraftLineTaxRateDisplay(line, column);
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
      line={line}
      taxCodeOptions={taxCodeOptions}
      align={column.align}
      compact={compact}
      disabled={disabled}
      onTaxCodeChange={(taxCodeId) =>
        patchLine(line.key, patchPoLineTaxCodeSelection(line, taxCodeId, taxCodeOptions))
      }
    />
  );
}

export function PoLineTaxRateCell({
  ctx,
  column,
  taxCodeOptions = [],
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
}) {
  const { line, disabled, patchLine } = ctx;

  if (!line.variant_id) {
    return null;
  }

  return (
    <PoLineTaxRateInput
      line={line}
      column={column}
      taxCodeOptions={taxCodeOptions}
      disabled={disabled}
      patchLine={patchLine}
    />
  );
}

export function PoLineTaxAmountCell({
  ctx,
  column,
  pricesTaxInclusive = false,
  showTaxRateSubline = false,
  taxRateColumn,
  taxCodeOptions = [],
}: {
  ctx: LineCellContext;
  column: DocumentColumnPref;
  pricesTaxInclusive?: boolean;
  showTaxRateSubline?: boolean;
  taxRateColumn?: DocumentColumnPref | null;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
}) {
  const { line, disabled, patchLine } = ctx;
  const value = resolvePoDraftLineTaxAmountDisplay(line, column, {
    purchasePricesTaxInclusive: pricesTaxInclusive,
    taxMechanism: ctx.taxMechanism,
  });
  const showStack =
    showTaxRateSubline && Boolean(line.variant_id) && Boolean(taxRateColumn);

  if (!showStack || !taxRateColumn) {
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
          <PoLineTaxRateInput
            line={line}
            column={taxRateColumn}
            taxCodeOptions={taxCodeOptions}
            disabled={disabled}
            patchLine={patchLine}
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
          DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
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
  taxMechanism,
}: {
  line: PoDraftLine;
  column: DocumentColumnPref;
  pricesTaxInclusive?: boolean;
  taxMechanism?: GstTaxMechanism;
}) {
  const decimalPlaces = resolveColumnDecimalPlaces(column);
  const resolved = resolvePoLineTaxAmount(line, {
    purchasePricesTaxInclusive: pricesTaxInclusive,
    taxMechanism,
  });
  const showStack = shouldShowPoLineTotalExTaxSubline(line, resolved);
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
          DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
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

export type PoLineEntryLayoutOptions = {
  showUnitUnderQty: boolean;
  discountAmountColumn?: DocumentColumnPref | null;
  showTaxRateUnderLineTax?: boolean;
  taxRateColumn?: DocumentColumnPref | null;
  showDiscountAmountUnderPct?: boolean;
  taxCodeOptions?: readonly PoLineTaxCodeOption[];
};

export function renderPoLineColumnCell(
  columnId: string,
  column: DocumentColumnPref,
  ctx: LineCellContext,
  nestedColumns: DocumentColumnPref[],
  imageDisplayMode: DocumentImageDisplayMode,
  layoutOptions: PoLineEntryLayoutOptions
) {
  const {
    showUnitUnderQty,
    discountAmountColumn,
    showTaxRateUnderLineTax = false,
    taxRateColumn,
    showDiscountAmountUnderPct = false,
    taxCodeOptions = [],
  } = layoutOptions;
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
  if (columnId === "mrp") {
    return <PoLineMrpCell ctx={ctx} column={column} />;
  }
  if (columnId === "discount_pct") {
    return (
      <PoLineDiscountPctCell
        ctx={ctx}
        column={column}
        discountAmountColumn={discountAmountColumn}
        showDiscountAmountSubline={showDiscountAmountUnderPct}
      />
    );
  }
  if (columnId === "discount_amount") {
    return <PoLineDiscountAmountCell ctx={ctx} column={column} />;
  }
  if (columnId === "tax_rate_pct") {
    return <PoLineTaxRateCell ctx={ctx} column={column} taxCodeOptions={taxCodeOptions} />;
  }
  if (columnId === "line_tax_amount") {
    return (
      <PoLineTaxAmountCell
        ctx={ctx}
        column={column}
        pricesTaxInclusive={ctx.pricesTaxInclusive}
        showTaxRateSubline={showTaxRateUnderLineTax}
        taxRateColumn={taxRateColumn}
        taxCodeOptions={taxCodeOptions}
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
        taxMechanism={ctx.taxMechanism}
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
