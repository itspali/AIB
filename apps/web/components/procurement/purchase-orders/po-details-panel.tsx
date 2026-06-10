"use client";

import type { ReactNode } from "react";
import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLayoutColumnPref,
} from "@/lib/documents/purchase-order-layout";
import {
  getVisiblePoFormHeaderDetailsFields,
  resolvePoFormFieldsGridProps,
  resolvePoFormFieldNarrowSpanClass,
} from "@/lib/documents/po-form-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import {
  poTaxSupplyNatureLabel,
  resolvePoGstContextFromForm,
} from "@/lib/procurement/purchase-orders/po-tax-supply";
import { gstTaxMechanismLabel, isGstImportSupplyNature } from "@/lib/tax/gst-supply-context";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { cn } from "@/lib/utils";

type DetailsDensity = "default" | "compact";

type Props = {
  form: PoDraftFormState;
  disabled?: boolean;
  layout?: "rail" | "stack";
  density?: DetailsDensity;
  className?: string;
  documentLayout?: DocumentLayoutTemplate;
  suppliers?: ProcurementSupplierOption[];
  locations?: ProcurementLocationOption[];
  tenantCountry?: string | null;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

const DETAILS_LABEL_CLASS = "min-w-0 flex-1 truncate text-muted-foreground";

function resolveCompactDetailsLabel(field: DocumentColumnPref, fallbackLabel: string): string {
  switch (field.id) {
    case "payment_terms_days":
      return "Terms (days)";
    case "expected_delivery_date":
      return "Delivery";
    case "requisition_number":
      return "Requisition";
    case "tax_supply_nature":
      return "Supply type";
    default:
      return field.label || fallbackLabel;
  }
}

function resolveDetailsStyles(density: DetailsDensity) {
  const compact = density === "compact";
  return {
    cardPadding: compact ? "p-3" : "p-4",
    listGap: compact ? "space-y-1 text-sm" : undefined,
    gridGap: compact ? "gap-2" : "gap-4",
    fieldGap: compact ? undefined : "space-y-2",
    row: compact ? "flex min-h-7 items-center gap-2.5" : undefined,
    labelClass: compact ? cn(DETAILS_LABEL_CLASS, "text-sm leading-snug") : undefined,
    stackedLabelClass: compact ? "text-sm" : undefined,
    inputClass: compact ? "h-7 px-2 text-xs po-line-cell-surface" : undefined,
    inlineInputClass: compact
      ? "h-7 w-full max-w-[5rem] px-1.5 text-xs po-line-cell-surface text-right tabular-nums"
      : undefined,
    wideInlineInputClass: compact
      ? "h-7 w-full max-w-[7rem] px-1.5 text-xs po-line-cell-surface"
      : undefined,
    dateInlineInputClass: compact
      ? "po-date-input h-7 w-full max-w-[7rem] shrink-0 pl-1.5 pr-0.5 text-xs po-line-cell-surface"
      : "po-date-input",
    valueClass: compact ? "text-right text-sm font-medium" : "text-sm font-medium",
    hintClass: compact
      ? "text-right text-xs leading-snug text-muted-foreground"
      : "text-xs text-muted-foreground",
    controlWrap: compact ? "flex min-w-0 shrink-0 items-center justify-end gap-1.5" : undefined,
  };
}

function DetailsInlineRow({
  label,
  children,
  controlClassName,
  className,
  styles,
}: {
  label: ReactNode;
  children: ReactNode;
  controlClassName?: string;
  className?: string;
  styles: ReturnType<typeof resolveDetailsStyles>;
}) {
  return (
    <div className={cn(styles.row, className)}>
      {label}
      <div className={cn(styles.controlWrap, controlClassName)}>{children}</div>
    </div>
  );
}

function renderDetailsLabel(
  field: DocumentColumnPref,
  props: {
    htmlFor?: string;
    fallbackLabel: string;
    density: DetailsDensity;
    documentLayout: DocumentLayoutTemplate;
    styles: ReturnType<typeof resolveDetailsStyles>;
    inline?: boolean;
  }
) {
  const { density, documentLayout, styles, htmlFor, fallbackLabel, inline = false } = props;
  const columnPref = getPoLayoutColumnPref(documentLayout, field.id);

  return (
    <DocumentLayoutLabel
      htmlFor={htmlFor}
      field={columnPref}
      fallbackLabel={fallbackLabel}
      defaultClassName={inline ? styles.labelClass : styles.stackedLabelClass}
      className={inline ? "mb-0 font-normal" : undefined}
    >
      {density === "compact" && inline
        ? resolveCompactDetailsLabel(field, fallbackLabel)
        : undefined}
    </DocumentLayoutLabel>
  );
}

function renderDetailsField(
  field: DocumentColumnPref,
  props: Props,
  index: number,
  fields: DocumentColumnPref[]
): ReactNode {
  const {
    form,
    disabled = false,
    layout = "stack",
    density = "default",
    documentLayout = DEFAULT_PO_SCREEN_LAYOUT,
    onPatch,
  } = props;
  const isRail = layout === "rail";
  const isCompact = density === "compact";
  const styles = resolveDetailsStyles(density);
  const narrowSpanClass = resolvePoFormFieldNarrowSpanClass(index, fields, layout);
  const stackedFieldClassName = cn("min-w-0 w-full", styles.fieldGap, narrowSpanClass);
  const inputClassName = styles.inputClass;

  switch (field.id) {
    case "payment_terms_days": {
      const inputId = isRail ? "po-payment-terms-rail" : "po-payment-terms";
      const labelProps = {
        htmlFor: inputId,
        fallbackLabel: "Payment terms (days)",
        density,
        documentLayout,
        styles,
      };

      if (isCompact) {
        return (
          <DetailsInlineRow
            key={field.id}
            styles={styles}
            label={renderDetailsLabel(field, { ...labelProps, inline: true })}
          >
            <Input
              id={inputId}
              inputMode="numeric"
              disabled={disabled}
              value={form.payment_terms_days}
              className={cn(styles.inlineInputClass, "text-right tabular-nums")}
              onChange={(event) => onPatch({ payment_terms_days: event.target.value })}
            />
          </DetailsInlineRow>
        );
      }

      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderDetailsLabel(field, labelProps)}
          <Input
            id={inputId}
            inputMode="numeric"
            disabled={disabled}
            value={form.payment_terms_days}
            className={inputClassName}
            onChange={(event) => onPatch({ payment_terms_days: event.target.value })}
          />
        </div>
      );
    }
    case "requisition_number": {
      const inputId = isRail ? "po-requisition-rail" : "po-requisition";
      const labelProps = {
        htmlFor: inputId,
        fallbackLabel: "Requisition #",
        density,
        documentLayout,
        styles,
      };

      if (isCompact) {
        return (
          <DetailsInlineRow
            key={field.id}
            styles={styles}
            label={renderDetailsLabel(field, { ...labelProps, inline: true })}
          >
            <Input
              id={inputId}
              disabled={disabled}
              value={form.custom_fields.requisition_number}
              className={styles.wideInlineInputClass}
              onChange={(event) =>
                onPatch({
                  custom_fields: {
                    ...form.custom_fields,
                    requisition_number: event.target.value,
                  },
                })
              }
            />
          </DetailsInlineRow>
        );
      }

      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderDetailsLabel(field, labelProps)}
          <Input
            id={inputId}
            disabled={disabled}
            value={form.custom_fields.requisition_number}
            className={inputClassName}
            onChange={(event) =>
              onPatch({
                custom_fields: {
                  ...form.custom_fields,
                  requisition_number: event.target.value,
                },
              })
            }
          />
        </div>
      );
    }
    case "expected_delivery_date": {
      const inputId = isRail ? "po-delivery-date-rail" : "po-delivery-date";
      const labelProps = {
        htmlFor: inputId,
        fallbackLabel: "Expected delivery",
        density,
        documentLayout,
        styles,
      };

      if (isCompact) {
        return (
          <DetailsInlineRow
            key={field.id}
            styles={styles}
            label={renderDetailsLabel(field, { ...labelProps, inline: true })}
          >
            <Input
              id={inputId}
              type="date"
              disabled={disabled}
              value={form.custom_fields.expected_delivery_date}
              className={styles.dateInlineInputClass}
              onChange={(event) =>
                onPatch({
                  custom_fields: {
                    ...form.custom_fields,
                    expected_delivery_date: event.target.value,
                  },
                })
              }
            />
          </DetailsInlineRow>
        );
      }

      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderDetailsLabel(field, labelProps)}
          <Input
            id={inputId}
            type="date"
            disabled={disabled}
            value={form.custom_fields.expected_delivery_date}
            className={cn(inputClassName, styles.dateInlineInputClass)}
            onChange={(event) =>
              onPatch({
                custom_fields: {
                  ...form.custom_fields,
                  expected_delivery_date: event.target.value,
                },
              })
            }
          />
        </div>
      );
    }
    case "tax_supply_nature": {
      const suppliers = props.suppliers ?? [];
      const locations = props.locations ?? [];
      const gstCtx = resolvePoGstContextFromForm(
        suppliers,
        form.supplier_id,
        locations,
        form.destination_location_id,
        props.tenantCountry
      );
      const labelProps = {
        fallbackLabel: "Supply type",
        density,
        documentLayout,
        styles,
      };

      if (isCompact) {
        return (
          <div key={field.id} className={styles.row}>
            {renderDetailsLabel(field, { ...labelProps, inline: true })}
            <div className={styles.controlWrap}>
              <span className={styles.valueClass}>{poTaxSupplyNatureLabel(gstCtx.supplyNature)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className={styles.hintClass}>{gstTaxMechanismLabel(gstCtx.taxMechanism)}</span>
            </div>
          </div>
        );
      }

      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderDetailsLabel(field, labelProps)}
          <p className={styles.valueClass}>{poTaxSupplyNatureLabel(gstCtx.supplyNature)}</p>
          <p className={styles.hintClass}>{gstTaxMechanismLabel(gstCtx.taxMechanism)}</p>
          {isGstImportSupplyNature(gstCtx.supplyNature) ? (
            <p className={styles.hintClass}>
              No Indian GST on the foreign commercial invoice. Import tax is assessed at customs
              (goods) or under reverse charge (services).
            </p>
          ) : null}
        </div>
      );
    }
    default:
      return null;
  }
}

export function PoDetailsPanel({
  form,
  disabled = false,
  layout = "stack",
  density = "default",
  className,
  documentLayout = DEFAULT_PO_SCREEN_LAYOUT,
  suppliers = [],
  locations = [],
  tenantCountry = null,
  onPatch,
}: Props) {
  const isRail = layout === "rail";
  const isCompact = density === "compact";
  const styles = resolveDetailsStyles(density);
  const detailFields = getVisiblePoFormHeaderDetailsFields(documentLayout);

  if (detailFields.length === 0) return null;

  const grid = resolvePoFormFieldsGridProps(detailFields.length, isRail);

  const fields = detailFields.map((field, index) =>
    renderDetailsField(
      field,
      {
        form,
        disabled,
        layout,
        density,
        documentLayout,
        suppliers,
        locations,
        tenantCountry,
        onPatch,
      },
      index,
      detailFields
    )
  );

  return (
    <div className={cn("surface-inset min-w-0", styles.cardPadding, className)}>
      {isCompact ? (
        <div className={styles.listGap}>{fields}</div>
      ) : (
        <div className={grid.containerClassName}>
          <div className={cn(styles.gridGap, grid.gridClassName)}>{fields}</div>
        </div>
      )}
    </div>
  );
}
