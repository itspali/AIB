"use client";

import type { ReactNode } from "react";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLayoutColumnPref,
  getVisibleTotalsFields,
  normalizePoLayoutTemplate,
  PO_EDITABLE_TOTALS_FIELD_IDS,
} from "@/lib/documents/purchase-order-layout";
import {
  documentFieldLabelTypographyClassName,
  documentFieldValueTypographyClassName,
} from "@/lib/documents/document-typography-classes";
import { resolveColumnDecimalPlaces, normalizeDocumentDecimalInput } from "@/lib/documents/decimal-format";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import { Input } from "@/components/ui/input";
import { PoLineDiscountTypeSlot } from "@/components/procurement/purchase-orders/po-line-discount-type-slot";
import {
  computePurchaseOrderTotals,
  formatPoMoney,
  type PurchaseOrderTotalsSnapshot,
} from "@/lib/procurement/purchase-orders/totals";
import type { PoAutoRoundOffPolicy } from "@/lib/procurement/purchase-orders/po-auto-round-off";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import { filterSavablePoLines, type PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PoHeaderChargesFields } from "@/lib/procurement/purchase-orders/po-header-charges";
import { resolvePoShippingTaxAmount } from "@/lib/procurement/purchase-orders/po-header-charges";
import {
  patchPoTransactionDiscountAmountInput,
  patchPoTransactionDiscountPercentInput,
  patchPoTransactionDiscountType,
  resolvePoTransactionDiscountInputValue,
  resolvePoTransactionDiscountType,
} from "@/lib/procurement/purchase-orders/po-transaction-discount";
import { cn } from "@/lib/utils";

type TotalsDensity = "default" | "compact";

type Props = {
  lines: PoDraftLine[];
  className?: string;
  layout?: DocumentLayoutTemplate;
  layoutMode?: "rail" | "footer" | "embedded";
  density?: TotalsDensity;
  showSectionTitle?: boolean;
  showFooterOnLarge?: boolean;
  purchasePricesTaxInclusive?: boolean;
  taxMechanism?: GstTaxMechanism;
  headerCharges?: PoHeaderChargesFields;
  autoRoundOffPolicy?: PoAutoRoundOffPolicy;
  allowTransactionDiscounts?: boolean;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
};

const EDITABLE_TOTALS = new Set<string>(PO_EDITABLE_TOTALS_FIELD_IDS);

const TOTALS_LABEL_CLASS = "min-w-0 flex-1 text-muted-foreground";
const TOTALS_LABEL_COMPACT_CLASS = "min-w-0 flex-1 leading-snug text-muted-foreground";
const TOTALS_VALUE_CLASS = "shrink-0 text-right tabular-nums";

function resolveCompactTotalsLabel(field: DocumentColumnPref): string {
  switch (field.id) {
    case "subtotal_ex_tax":
      return "Subtotal";
    case "transaction_discount":
      return "Trade disc.";
    case "shipping_tax_amount":
      return "Ship tax %";
    case "additional_charges_amount":
      return "Add'l charges";
    default:
      return field.label;
  }
}

function resolveTotalsStyles(density: TotalsDensity) {
  const compact = density === "compact";
  return {
    row: compact ? "flex min-h-7 items-center gap-2.5" : "flex min-h-8 items-center gap-3",
    dl: compact ? "space-y-1 text-sm" : "space-y-1.5 text-sm",
    cardPadding: compact ? "p-3" : "p-4",
    grandTotalRow: compact ? "mt-1 pt-1.5" : "mt-1 border-t border-border pt-2",
    grandTotalText: compact
      ? "text-base font-semibold text-foreground"
      : "text-base font-semibold text-foreground",
    useCompactInputs: compact,
    labelClass: compact ? cn(TOTALS_LABEL_COMPACT_CLASS, "text-sm") : cn(TOTALS_LABEL_CLASS, "truncate"),
  };
}

function TotalsLabel({
  field,
  density,
  className,
  children,
}: {
  field: DocumentColumnPref;
  density: TotalsDensity;
  className?: string;
  children?: ReactNode;
}) {
  const styles = resolveTotalsStyles(density);
  const label = children ?? (density === "compact" ? resolveCompactTotalsLabel(field) : field.label);

  return (
    <dt className={documentFieldLabelTypographyClassName(field, cn(styles.labelClass, className))}>
      {label}
    </dt>
  );
}

function resolveTotalsValue(field: DocumentColumnPref, totals: PurchaseOrderTotalsSnapshot): string {
  const decimalPlaces = resolveColumnDecimalPlaces(field);
  switch (field.id) {
    case "line_count":
      return String(totals.filledLineCount);
    case "subtotal_ex_tax":
      return formatPoMoney(totals.subtotalGross, decimalPlaces);
    case "transaction_discount":
      return formatPoMoney(totals.transactionDiscountAmount, decimalPlaces);
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
  compact = false,
}: {
  value: string;
  align?: DocumentColumnPref["align"];
  disabled?: boolean;
  decimalPlaces: number;
  onChange: (value: string) => void;
  onBlurNormalize?: (value: string) => void;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <Input
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onBlurNormalize?.(normalizeDocumentDecimalInput(value, decimalPlaces))}
      className={cn(
        "border border-border po-line-cell-surface px-1.5 tabular-nums shadow-none focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        compact ? "h-7 max-w-[5rem] px-1.5 text-xs" : "h-7 w-full max-w-[6.5rem] text-sm",
        align === "right" && "text-right"
      )}
    />
  );
}

function TransactionDiscountEditableRow({
  field,
  headerCharges,
  totals,
  density,
  disabled,
  allowTransactionDiscounts,
  onHeaderChargesChange,
}: {
  field: DocumentColumnPref;
  headerCharges: PoHeaderChargesFields;
  totals: PurchaseOrderTotalsSnapshot;
  density: TotalsDensity;
  disabled?: boolean;
  allowTransactionDiscounts?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
}) {
  const styles = resolveTotalsStyles(density);
  const decimalPlaces = resolveColumnDecimalPlaces(field);
  const discountType = resolvePoTransactionDiscountType(headerCharges);
  const inputValue = resolvePoTransactionDiscountInputValue(headerCharges);
  const displayAmount = formatPoMoney(totals.transactionDiscountAmount, decimalPlaces);
  const canEdit =
    allowTransactionDiscounts === true &&
    Boolean(onHeaderChargesChange) &&
    !disabled;

  const patchInput = (raw: string) => {
    onHeaderChargesChange?.(
      discountType === "amount"
        ? patchPoTransactionDiscountAmountInput(raw)
        : patchPoTransactionDiscountPercentInput(raw)
    );
  };

  if (!canEdit) {
    if (totals.transactionDiscountAmount <= 0) {
      return null;
    }
    return (
      <div className={styles.row} data-totals-row>
        <TotalsLabel field={field} density={density} />
        <dd
          className={documentFieldValueTypographyClassName(
            field,
            cn(TOTALS_VALUE_CLASS, "font-medium text-foreground")
          )}
        >
          {displayAmount}
        </dd>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-0.5">
      <div className={styles.row} data-totals-row>
        <TotalsLabel field={field} density={density} />
        <dd
          className={documentFieldValueTypographyClassName(
            field,
            cn(TOTALS_VALUE_CLASS, "font-medium text-foreground")
          )}
        >
          {displayAmount}
        </dd>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <EditableChargeInput
          compact
          value={inputValue}
          align={field.align}
          disabled={disabled}
          decimalPlaces={decimalPlaces}
          ariaLabel={discountType === "amount" ? "Trade discount amount" : "Trade discount percent"}
          onChange={patchInput}
          onBlurNormalize={(normalized) => patchInput(normalized)}
        />
        <PoLineDiscountTypeSlot
          type={discountType}
          disabled={disabled}
          onTypeChange={(type) => onHeaderChargesChange?.(patchPoTransactionDiscountType(headerCharges, type))}
        />
      </div>
    </div>
  );
}

function ShippingTaxEditableRow({
  field,
  headerCharges,
  density,
  disabled,
  onHeaderChargesChange,
}: {
  field: DocumentColumnPref;
  headerCharges: PoHeaderChargesFields;
  density: TotalsDensity;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
}) {
  const styles = resolveTotalsStyles(density);
  const decimalPlaces = resolveColumnDecimalPlaces(field);
  const displayAmount = formatPoMoney(resolvePoShippingTaxAmount(headerCharges), decimalPlaces);
  const rateValue = headerCharges.shipping_tax_rate_pct;

  const patchRate = (value: string) => {
    onHeaderChargesChange?.({
      shipping_tax_rate_pct: value,
      shipping_tax_type: "percent",
    });
  };

  if (!onHeaderChargesChange) {
    return (
      <div className={styles.row} data-totals-row>
        <TotalsLabel field={field} density={density} />
        <dd
          className={documentFieldValueTypographyClassName(
            field,
            cn(TOTALS_VALUE_CLASS, "font-medium text-foreground")
          )}
        >
          {displayAmount}
        </dd>
      </div>
    );
  }

  if (density === "compact") {
    return (
      <div className={styles.row} data-totals-row>
        <TotalsLabel field={field} density={density} />
        <dd className="flex shrink-0 items-center justify-end gap-1">
          <span
            className={documentFieldValueTypographyClassName(
              field,
              cn(TOTALS_VALUE_CLASS, "font-medium text-foreground")
            )}
          >
            {displayAmount}
          </span>
          <EditableChargeInput
            compact
            value={rateValue}
            align={field.align}
            disabled={disabled}
            decimalPlaces={decimalPlaces}
            ariaLabel={`${field.label} rate percent`}
            onChange={patchRate}
            onBlurNormalize={(normalized) => patchRate(normalized)}
          />
        </dd>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-0.5">
      <div className={styles.row} data-totals-row>
        <TotalsLabel field={field} density={density} />
        <dd
          className={documentFieldValueTypographyClassName(
            field,
            cn(TOTALS_VALUE_CLASS, "font-medium text-foreground")
          )}
        >
          {displayAmount}
        </dd>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <EditableChargeInput
          compact
          value={rateValue}
          align={field.align}
          disabled={disabled}
          decimalPlaces={decimalPlaces}
          ariaLabel={`${field.label} rate percent`}
          onChange={patchRate}
          onBlurNormalize={(normalized) => patchRate(normalized)}
        />
      </div>
    </div>
  );
}

function TotalsFieldRow({
  field,
  totals,
  headerCharges,
  autoRoundOffPolicy,
  allowTransactionDiscounts,
  density,
  disabled,
  onHeaderChargesChange,
}: {
  field: DocumentColumnPref;
  totals: PurchaseOrderTotalsSnapshot;
  headerCharges?: PoHeaderChargesFields;
  autoRoundOffPolicy?: PoAutoRoundOffPolicy;
  allowTransactionDiscounts?: boolean;
  density: TotalsDensity;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
}) {
  const styles = resolveTotalsStyles(density);
  const isGrandTotal = field.id === "grand_total";
  const autoRoundOffEnabled = autoRoundOffPolicy?.enabled === true;
  const isEditable =
    EDITABLE_TOTALS.has(field.id) &&
    field.id !== "shipping_tax_amount" &&
    field.id !== "transaction_discount" &&
    !(field.id === "round_off_amount" && autoRoundOffEnabled) &&
    Boolean(onHeaderChargesChange) &&
    Boolean(headerCharges);

  if (field.id === "transaction_discount" && headerCharges) {
    return (
      <TransactionDiscountEditableRow
        field={field}
        headerCharges={headerCharges}
        totals={totals}
        density={density}
        disabled={disabled}
        allowTransactionDiscounts={allowTransactionDiscounts}
        onHeaderChargesChange={onHeaderChargesChange}
      />
    );
  }

  if (field.id === "shipping_tax_amount" && headerCharges && onHeaderChargesChange) {
    return (
      <ShippingTaxEditableRow
        field={field}
        headerCharges={headerCharges}
        density={density}
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
      className={cn(styles.row, isGrandTotal && styles.grandTotalRow)}
      data-totals-row
    >
      <TotalsLabel
        field={field}
        density={density}
        className={isGrandTotal ? "font-semibold text-foreground" : undefined}
      />
      <dd
        className={documentFieldValueTypographyClassName(
          field,
          cn("shrink-0", isEditable ? "" : TOTALS_VALUE_CLASS)
        )}
      >
        {isEditable && chargeKey && headerCharges ? (
          <EditableChargeInput
            compact={styles.useCompactInputs}
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
                ? styles.grandTotalText
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
  autoRoundOffPolicy,
  allowTransactionDiscounts,
  density,
  disabled,
  onHeaderChargesChange,
}: {
  totals: PurchaseOrderTotalsSnapshot;
  fields: DocumentColumnPref[];
  headerCharges?: PoHeaderChargesFields;
  autoRoundOffPolicy?: PoAutoRoundOffPolicy;
  allowTransactionDiscounts?: boolean;
  density: TotalsDensity;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
}) {
  const styles = resolveTotalsStyles(density);

  return (
    <dl className={cn(styles.dl, density === "compact" && "po-totals-compact")}>
      {fields.map((field) => (
        <TotalsFieldRow
          key={field.id}
          field={field}
          totals={totals}
          headerCharges={headerCharges}
          autoRoundOffPolicy={autoRoundOffPolicy}
          allowTransactionDiscounts={allowTransactionDiscounts}
          density={density}
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
  autoRoundOffPolicy,
  allowTransactionDiscounts,
  density,
  disabled,
  onHeaderChargesChange,
  className,
}: {
  totals: PurchaseOrderTotalsSnapshot;
  fields: DocumentColumnPref[];
  headerCharges?: PoHeaderChargesFields;
  autoRoundOffPolicy?: PoAutoRoundOffPolicy;
  allowTransactionDiscounts?: boolean;
  density: TotalsDensity;
  disabled?: boolean;
  onHeaderChargesChange?: (patch: Partial<PoHeaderChargesFields>) => void;
  className?: string;
}) {
  const styles = resolveTotalsStyles(density);

  return (
    <div
      className={cn(
        "surface-inset min-w-0 overflow-hidden",
        styles.cardPadding,
        density === "compact" && "po-totals-compact",
        className
      )}
    >
      <TotalsBody
        totals={totals}
        fields={fields}
        headerCharges={headerCharges}
        autoRoundOffPolicy={autoRoundOffPolicy}
        allowTransactionDiscounts={allowTransactionDiscounts}
        density={density}
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
  density = "default",
  showSectionTitle = true,
  showFooterOnLarge = false,
  purchasePricesTaxInclusive = false,
  taxMechanism,
  headerCharges,
  autoRoundOffPolicy,
  allowTransactionDiscounts = false,
  disabled = false,
  onHeaderChargesChange,
}: Props) {
  const resolvedLayout = normalizePoLayoutTemplate(layout);
  const visibleTotalsFields = getVisibleTotalsFields(resolvedLayout);
  const totals = computePurchaseOrderTotals(filterSavablePoLines(lines), {
    purchasePricesTaxInclusive,
    taxMechanism,
    headerCharges,
    autoRoundOff: autoRoundOffPolicy,
    allowTransactionDiscounts,
  });

  if (layoutMode === "embedded") {
    return (
      <TotalsCard
        totals={totals}
        fields={visibleTotalsFields}
        headerCharges={headerCharges}
        autoRoundOffPolicy={autoRoundOffPolicy}
        allowTransactionDiscounts={allowTransactionDiscounts}
        density={density}
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
          autoRoundOffPolicy={autoRoundOffPolicy}
          density={density}
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
        autoRoundOffPolicy={autoRoundOffPolicy}
        allowTransactionDiscounts={allowTransactionDiscounts}
        density={density}
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
