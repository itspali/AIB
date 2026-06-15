"use client";

import type { ReactNode } from "react";
import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  getSalesLayoutColumnPref,
} from "@/lib/sales/shared/sales-commerce-layout";
import {
  getVisibleSalesFormHeaderDetailsFields,
  resolveSalesFormFieldNarrowSpanClass,
  resolveSalesFormFieldsGridProps,
} from "@/lib/sales/shared/sales-form-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import {
  resolveSalesGstContextFromForm,
  salesTaxSupplyNatureLabel,
} from "@/lib/sales/shared/sales-tax-supply";
import { gstTaxMechanismLabel } from "@/lib/tax/gst-supply-context";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { cn } from "@/lib/utils";

type DetailsDensity = "default" | "compact";

export type SalesCommerceDetailsCustomFields = {
  customer_po_number?: string;
  customer_reference?: string;
  requested_ship_date?: string;
};

export type SalesCommerceDetailsForm = {
  customer_id: string;
  payment_terms_days: string;
  custom_fields: SalesCommerceDetailsCustomFields;
};

type Props<TForm extends SalesCommerceDetailsForm> = {
  form: TForm;
  originLocationId: string;
  requisitionField?: keyof SalesCommerceDetailsCustomFields;
  deliveryDateField?: keyof SalesCommerceDetailsCustomFields;
  disabled?: boolean;
  layout?: "rail" | "stack";
  density?: DetailsDensity;
  className?: string;
  documentLayout?: DocumentLayoutTemplate;
  customers?: CustomerOption[];
  locations?: SalesLocationOption[];
  tenantCountry?: string | null;
  onPatch: (patch: Partial<TForm & { custom_fields: SalesCommerceDetailsCustomFields }>) => void;
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

function renderDetailsField<TForm extends SalesCommerceDetailsForm>(
  field: DocumentColumnPref,
  props: Props<TForm>,
  index: number,
  fields: DocumentColumnPref[]
): ReactNode {
  const {
    form,
    originLocationId,
    requisitionField = "customer_po_number",
    deliveryDateField = "requested_ship_date",
    disabled = false,
    layout = "stack",
    density = "default",
    documentLayout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
    onPatch,
  } = props;
  const isRail = layout === "rail";
  const isCompact = density === "compact";
  const styles = resolveDetailsStyles(density);
  const narrowSpanClass = resolveSalesFormFieldNarrowSpanClass(index, fields, layout);
  const stackedFieldClassName = cn("min-w-0 w-full", styles.fieldGap, narrowSpanClass);

  const renderLabel = (fallbackLabel: string, htmlFor?: string, inline = false) => (
    <DocumentLayoutLabel
      htmlFor={htmlFor}
      field={getSalesLayoutColumnPref(documentLayout, field.id)}
      fallbackLabel={fallbackLabel}
      defaultClassName={inline ? styles.labelClass : styles.stackedLabelClass}
      className={inline ? "mb-0 font-normal" : undefined}
    >
      {density === "compact" && inline
        ? resolveCompactDetailsLabel(field, fallbackLabel)
        : undefined}
    </DocumentLayoutLabel>
  );

  switch (field.id) {
    case "payment_terms_days": {
      const inputId = isRail ? "sales-payment-terms-rail" : "sales-payment-terms";
      if (isCompact) {
        return (
          <DetailsInlineRow key={field.id} styles={styles} label={renderLabel("Payment terms (days)", inputId, true)}>
            <Input
              id={inputId}
              inputMode="numeric"
              disabled={disabled}
              value={form.payment_terms_days}
              className={cn(styles.inlineInputClass, "text-right tabular-nums")}
              onChange={(event) => onPatch({ payment_terms_days: event.target.value } as Partial<TForm>)}
            />
          </DetailsInlineRow>
        );
      }
      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderLabel("Payment terms (days)", inputId)}
          <Input
            id={inputId}
            inputMode="numeric"
            disabled={disabled}
            value={form.payment_terms_days}
            className={styles.inputClass}
            onChange={(event) => onPatch({ payment_terms_days: event.target.value } as Partial<TForm>)}
          />
        </div>
      );
    }
    case "requisition_number": {
      const inputId = isRail ? "sales-requisition-rail" : "sales-requisition";
      const value = form.custom_fields[requisitionField] ?? "";
      if (isCompact) {
        return (
          <DetailsInlineRow key={field.id} styles={styles} label={renderLabel("Requisition #", inputId, true)}>
            <Input
              id={inputId}
              disabled={disabled}
              value={value}
              className={styles.wideInlineInputClass}
              onChange={(event) =>
                onPatch({
                  custom_fields: { ...form.custom_fields, [requisitionField]: event.target.value },
                } as Partial<TForm>)
              }
            />
          </DetailsInlineRow>
        );
      }
      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderLabel("Requisition #", inputId)}
          <Input
            id={inputId}
            disabled={disabled}
            value={value}
            className={styles.inputClass}
            onChange={(event) =>
              onPatch({
                custom_fields: { ...form.custom_fields, [requisitionField]: event.target.value },
              } as Partial<TForm>)
            }
          />
        </div>
      );
    }
    case "expected_delivery_date": {
      const inputId = isRail ? "sales-delivery-date-rail" : "sales-delivery-date";
      const value = form.custom_fields[deliveryDateField] ?? "";
      if (isCompact) {
        return (
          <DetailsInlineRow key={field.id} styles={styles} label={renderLabel("Delivery date", inputId, true)}>
            <Input
              id={inputId}
              type="date"
              disabled={disabled}
              value={value}
              className={styles.dateInlineInputClass}
              onChange={(event) =>
                onPatch({
                  custom_fields: { ...form.custom_fields, [deliveryDateField]: event.target.value },
                } as Partial<TForm>)
              }
            />
          </DetailsInlineRow>
        );
      }
      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderLabel("Delivery date", inputId)}
          <Input
            id={inputId}
            type="date"
            disabled={disabled}
            value={value}
            className={cn(styles.inputClass, styles.dateInlineInputClass)}
            onChange={(event) =>
              onPatch({
                custom_fields: { ...form.custom_fields, [deliveryDateField]: event.target.value },
              } as Partial<TForm>)
            }
          />
        </div>
      );
    }
    case "tax_supply_nature": {
      const customers = props.customers ?? [];
      const locations = props.locations ?? [];
      const gstCtx = resolveSalesGstContextFromForm(
        customers,
        form.customer_id,
        locations,
        originLocationId,
        props.tenantCountry
      );
      if (isCompact) {
        return (
          <div key={field.id} className={styles.row}>
            {renderLabel("Supply type", undefined, true)}
            <div className={styles.controlWrap}>
              <span className={styles.valueClass}>{salesTaxSupplyNatureLabel(gstCtx.supplyNature)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className={styles.hintClass}>{gstTaxMechanismLabel(gstCtx.taxMechanism)}</span>
            </div>
          </div>
        );
      }
      return (
        <div key={field.id} className={stackedFieldClassName}>
          {renderLabel("Supply type")}
          <p className={styles.valueClass}>{salesTaxSupplyNatureLabel(gstCtx.supplyNature)}</p>
          <p className={styles.hintClass}>{gstTaxMechanismLabel(gstCtx.taxMechanism)}</p>
        </div>
      );
    }
    default:
      return null;
  }
}

export function SalesCommerceDetailsPanel<TForm extends SalesCommerceDetailsForm>({
  form,
  originLocationId,
  requisitionField,
  deliveryDateField,
  disabled = false,
  layout = "stack",
  density = "default",
  className,
  documentLayout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  customers = [],
  locations = [],
  tenantCountry = null,
  onPatch,
}: Props<TForm>) {
  const isRail = layout === "rail";
  const isCompact = density === "compact";
  const styles = resolveDetailsStyles(density);
  const detailFields = getVisibleSalesFormHeaderDetailsFields(documentLayout);

  if (detailFields.length === 0) return null;

  const grid = resolveSalesFormFieldsGridProps(detailFields.length, isRail);
  const fields = detailFields.map((field, index) =>
    renderDetailsField(
      field,
      {
        form,
        originLocationId,
        requisitionField,
        deliveryDateField,
        disabled,
        layout,
        density,
        documentLayout,
        customers,
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
