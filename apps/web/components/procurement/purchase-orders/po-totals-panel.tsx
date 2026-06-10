"use client";

import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLayoutColumnPref,
  getVisibleTotalsFields,
  normalizePoLayoutTemplate,
  PO_EDITABLE_TOTALS_FIELD_IDS,
} from "@/lib/documents/purchase-order-layout";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import { resolveColumnDecimalPlaces, normalizeDocumentDecimalInput } from "@/lib/documents/decimal-format";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import { Input } from "@/components/ui/input";
import { PoLineDiscountTypeSlot } from "@/components/procurement/purchase-orders/po-line-discount-type-slot";
import {
  PoLineQtyValueStack,
  PO_LINE_SUBLINE_TEXT_CLASS,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import {
  computePurchaseOrderTotals,
  formatPoMoney,
  type PurchaseOrderTotalsSnapshot,
} from "@/lib/procurement/purchase-orders/totals";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import { filterSavablePoLines, type PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PoHeaderChargesFields } from "@/lib/procurement/purchase-orders/po-header-charges";
import {
  resolvePoShippingTaxAmount,
  resolvePoShippingTaxInputValue,
  resolvePoShippingTaxType,
  type PoShippingTaxType,
} from "@/lib/procurement/purchase-orders/po-header-charges";
import { cn } from "@/lib/utils";

type Props = {
  lines: PoDraftLine[];
  className?: string;
  layout?: DocumentLayoutTemplate;
  layoutMode?: "rail" | "footer" | "embedded";
  showSectionTitle?: boolean;
  showFooterOnLarge?: boolean;
  purchasePricesTaxInclusive?: boolean;
  taxMechanism?: GstTaxMechanism;
  headerCharges?: PoHeaderChargesFields;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
};

const EDITABLE_TOTALS = new Set<string>(PO_EDITABLE_TOTALS_FIELD_IDS);

function resolveTotalsValue(field: DocumentColumnPref, totals: PurchaseOrderTotalsSnapshot): string {
  const decimalPlaces = resolveColumnDecimalPlaces(field);
  switch (field.id) {
    case "line_count":
      return String(totals.filledLineCount);
    case "subtotal_ex_tax":
      return formatPoMoney(totals.subtotalGross, decimalPlaces);
    case "tax_amount":
      return formatPoMoney(totals.taxAmount, decimalPlaces);
    case "shipping_amount":
      return formatPoMoney(totals.shippingAmount, decimalPlaces);
    case "shipping_tax_amount":
      return formatPoMoney(totals.shippingTaxAmount, decimalPlaces);
    case "round_off_amount":
      return formatPoMoney(totals.roundOffAmount, decimalPlaces);
    case "additional_charges_amount":
      return formatPoMoney(totals.additionalChargesAmount, decimalPlaces);
    case "grand_total":
      return formatPoMoney(totals.grandTotal, decimalPlaces);
    default:
      return "—";
  }
}

function EditableChargeInput({
  value,
  align,
  disabled,
  decimalPlaces,
  onChange,
  onBlurNormalize,
  ariaLabel,
}: {
  value: string;
  align?: DocumentColumnPref["align"];
  disabled?: boolean;
  decimalPlaces: number;
  onChange: (value: string) => void;
  onBlurNormalize?: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <Input
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onBlurNormalize?.(normalizeDocumentDecimalInput(value, decimalPlaces))}
      className={cn(
        "h-7 w-[7.5rem] border-transparent bg-transparent px-1.5 text-sm shadow-none focus-visible:border-border focus-visible:bg-background",
        "tabular-nums",
        align === "right" && "text-right"
      )}
    />
  );
}

function ShippingTaxEditableRow({
  field,
  headerCharges,
  disabled,
  onHeaderChargesChange,
}: {
  field: DocumentColumnPref;
  headerCharges: PoHeaderChargesFields;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
}) {
  const taxType = resolvePoShippingTaxType(headerCharges);
  const decimalPlaces = resolveColumnDecimalPlaces(field);
  const displayAmount = formatPoMoney(resolvePoShippingTaxAmount(headerCharges), decimalPlaces);
  const inputValue = resolvePoShippingTaxInputValue(headerCharges);

  const patchTax = (patch: Partial<PoHeaderChargesFields>) => {
    onHeaderChargesChange?.(patch);
  };

  if (!onHeaderChargesChange) {
    return (
      <div className="flex items-center justify-between gap-3">
        <dt
          className={documentFieldTypographyClassName(
            field,
            "min-w-0 text-muted-foreground"
          )}
        >
          {field.label}
        </dt>
        <dd
          className={documentFieldTypographyClassName(
            field,
            "shrink-0 text-right tabular-nums font-medium text-foreground"
          )}
        >
          {formatPoMoney(resolvePoShippingTaxAmount(headerCharges), decimalPlaces)}
        </dd>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <dt
        className={documentFieldTypographyClassName(
          field,
          "min-w-0 text-muted-foreground"
        )}
      >
        {field.label}
      </dt>
      <dd className="shrink-0">
        <PoLineQtyValueStack
          showUnitUnderQty
          align={field.align ?? "right"}
          unitSlot={
            <PoLineDiscountTypeSlot
              type={taxType}
              align={field.align ?? "right"}
              disabled={disabled}
              onTypeChange={(nextType: PoShippingTaxType) =>
                patchTax({ shipping_tax_type: nextType })
              }
            />
          }
        >
          <EditableChargeInput
            value={inputValue}
            align={field.align}
            disabled={disabled}
            decimalPlaces={decimalPlaces}
            ariaLabel={field.label}
            onChange={(value) =>
              patchTax(
                taxType === "amount"
                  ? { shipping_tax_amount: value }
                  : { shipping_tax_rate_pct: value }
              )
            }
            onBlurNormalize={(normalized) =>
              patchTax(
                taxType === "amount"
                  ? { shipping_tax_amount: normalized }
                  : { shipping_tax_rate_pct: normalized }
              )
            }
          />
        </PoLineQtyValueStack>
        {taxType === "percent" ? (
          <span
            className={cn(
              "mt-0.5 block px-1 text-[10px] tabular-nums text-muted-foreground",
              field.align === "right" ? "text-right" : "text-left",
              PO_LINE_SUBLINE_TEXT_CLASS
            )}
          >
            {displayAmount}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function TotalsFieldRow({
  field,
  totals,
  headerCharges,
  disabled,
  onHeaderChargesChange,
}: {
  field: DocumentColumnPref;
  totals: PurchaseOrderTotalsSnapshot;
  headerCharges?: PoHeaderChargesFields;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
}) {
  const isGrandTotal = field.id === "grand_total";
  const isEditable =
    EDITABLE_TOTALS.has(field.id) &&
    field.id !== "shipping_tax_amount" &&
    Boolean(onHeaderChargesChange) &&
    Boolean(headerCharges);

  if (field.id === "shipping_tax_amount" && headerCharges && onHeaderChargesChange) {
    return (
      <ShippingTaxEditableRow
        field={field}
        headerCharges={headerCharges}
        disabled={disabled}
        onHeaderChargesChange={onHeaderChargesChange}
      />
    );
  }

  const chargeKey =
    field.id === "shipping_amount"
      ? "shipping_amount"
      : field.id === "round_off_amount"
        ? "round_off_amount"
        : field.id === "additional_charges_amount"
          ? "additional_charges_amount"
          : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        isGrandTotal && "border-t border-border pt-2"
      )}
    >
      <dt
        className={documentFieldTypographyClassName(
          field,
          cn(
            "min-w-0",
            isGrandTotal ? "font-semibold text-foreground" : "text-muted-foreground"
          )
        )}
      >
        {field.label}
      </dt>
      <dd
        className={documentFieldTypographyClassName(
          field,
          cn("shrink-0", isEditable ? "" : "text-right tabular-nums")
        )}
      >
        {isEditable && chargeKey && headerCharges ? (
          <EditableChargeInput
            value={headerCharges[chargeKey]}
            align={field.align}
            disabled={disabled}
            decimalPlaces={resolveColumnDecimalPlaces(field)}
            ariaLabel={field.label}
            onChange={(value) => onHeaderChargesChange?.({ [chargeKey]: value })}
            onBlurNormalize={(normalized) =>
              onHeaderChargesChange?.({ [chargeKey]: normalized })
            }
          />
        ) : (
          <span
            className={cn(
              isGrandTotal
                ? "text-base font-semibold text-foreground"
                : field.id === "tax_amount"
                  ? "font-medium text-muted-foreground"
                  : "font-medium text-foreground"
            )}
          >
            {resolveTotalsValue(field, totals)}
          </span>
        )}
      </dd>
    </div>
  );
}

function TotalsBody({
  totals,
  fields,
  headerCharges,
  disabled,
  onHeaderChargesChange,
}: {
  totals: PurchaseOrderTotalsSnapshot;
  fields: DocumentColumnPref[];
  headerCharges?: PoHeaderChargesFields;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
}) {
  return (
    <dl className="space-y-2 text-sm">
      {fields.map((field) => (
        <TotalsFieldRow
          key={field.id}
          field={field}
          totals={totals}
          headerCharges={headerCharges}
          disabled={disabled}
          onHeaderChargesChange={onHeaderChargesChange}
        />
      ))}
    </dl>
  );
}

function TotalsCard({
  totals,
  fields,
  headerCharges,
  disabled,
  onHeaderChargesChange,
  className,
}: {
  totals: PurchaseOrderTotalsSnapshot;
  fields: DocumentColumnPref[];
  headerCharges?: PoHeaderChargesFields;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
  className?: string;
}) {
  return (
    <div className={cn("surface-inset p-4", className)}>
      <TotalsBody
        totals={totals}
        fields={fields}
        headerCharges={headerCharges}
        disabled={disabled}
        onHeaderChargesChange={onHeaderChargesChange}
      />
    </div>
  );
}

export function PoTotalsPanel({
  lines,
  className,
  layout = DEFAULT_PO_SCREEN_LAYOUT,
  layoutMode = "rail",
  showSectionTitle = true,
  showFooterOnLarge = false,
  purchasePricesTaxInclusive = false,
  taxMechanism,
  headerCharges,
  disabled = false,
  onHeaderChargesChange,
}: Props) {
  const resolvedLayout = normalizePoLayoutTemplate(layout);
  const visibleTotalsFields = getVisibleTotalsFields(resolvedLayout);
  const totals = computePurchaseOrderTotals(filterSavablePoLines(lines), {
    purchasePricesTaxInclusive,
    taxMechanism,
    headerCharges,
  });

  if (layoutMode === "embedded") {
    return (
      <TotalsCard
        totals={totals}
        fields={visibleTotalsFields}
        headerCharges={headerCharges}
        disabled={disabled}
        onHeaderChargesChange={onHeaderChargesChange}
        className={className}
      />
    );
  }

  if (layoutMode === "footer") {
    return (
      <div
        className={cn(
          "shrink-0 border-t border-border pt-3",
          !showFooterOnLarge && "lg:hidden",
          className
        )}
      >
        <TotalsBody
          totals={totals}
          fields={visibleTotalsFields}
          headerCharges={headerCharges}
          disabled={disabled}
          onHeaderChargesChange={onHeaderChargesChange}
        />
      </div>
    );
  }

  return (
    <aside className={cn("hidden min-w-0 flex-col gap-3 lg:flex", className)}>
      {showSectionTitle ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
      ) : null}
      <TotalsCard
        totals={totals}
        fields={visibleTotalsFields}
        headerCharges={headerCharges}
        disabled={disabled}
        onHeaderChargesChange={onHeaderChargesChange}
      />
    </aside>
  );
}

export function getPoShippingTaxRateColumnPref(
  layout: DocumentLayoutTemplate = DEFAULT_PO_SCREEN_LAYOUT
) {
  return getPoLayoutColumnPref(normalizePoLayoutTemplate(layout), "shipping_tax_rate_pct");
}
