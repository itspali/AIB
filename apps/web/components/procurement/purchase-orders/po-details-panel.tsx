"use client";

import type { ReactNode } from "react";
import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLayoutColumnPref,
} from "@/lib/documents/purchase-order-layout";
import { getVisiblePoFormHeaderDetailsFields, resolvePoFormFieldsGridProps, resolvePoFormFieldNarrowSpanClass } from "@/lib/documents/po-form-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import { cn } from "@/lib/utils";

type Props = {
  form: PoDraftFormState;
  disabled?: boolean;
  /** Single column for the right rail; responsive grid when stacked above lines. */
  layout?: "rail" | "stack";
  className?: string;
  documentLayout?: DocumentLayoutTemplate;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

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
    documentLayout = DEFAULT_PO_SCREEN_LAYOUT,
    onPatch,
  } = props;
  const isRail = layout === "rail";
  const narrowSpanClass = resolvePoFormFieldNarrowSpanClass(index, fields, layout);
  const fieldClassName = cn("min-w-0 w-full space-y-2", narrowSpanClass);

  switch (field.id) {
    case "payment_terms_days":
      return (
        <div key={field.id} className={fieldClassName}>
          <DocumentLayoutLabel
            htmlFor={isRail ? "po-payment-terms-rail" : "po-payment-terms"}
            field={getPoLayoutColumnPref(documentLayout, "payment_terms_days")}
            fallbackLabel="Payment terms (days)"
          />
          <Input
            id={isRail ? "po-payment-terms-rail" : "po-payment-terms"}
            inputMode="numeric"
            disabled={disabled}
            value={form.payment_terms_days}
            onChange={(event) => onPatch({ payment_terms_days: event.target.value })}
          />
        </div>
      );
    case "requisition_number":
      return (
        <div key={field.id} className={fieldClassName}>
          <DocumentLayoutLabel
            htmlFor={isRail ? "po-requisition-rail" : "po-requisition"}
            field={getPoLayoutColumnPref(documentLayout, "requisition_number")}
            fallbackLabel="Requisition #"
          />
          <Input
            id={isRail ? "po-requisition-rail" : "po-requisition"}
            disabled={disabled}
            value={form.custom_fields.requisition_number}
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
    case "expected_delivery_date":
      return (
        <div key={field.id} className={fieldClassName}>
          <DocumentLayoutLabel
            htmlFor={isRail ? "po-delivery-date-rail" : "po-delivery-date"}
            field={getPoLayoutColumnPref(documentLayout, "expected_delivery_date")}
            fallbackLabel="Expected delivery"
          />
          <Input
            id={isRail ? "po-delivery-date-rail" : "po-delivery-date"}
            type="date"
            disabled={disabled}
            value={form.custom_fields.expected_delivery_date}
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
    case "internal_notes":
      return (
        <div
          key={field.id}
          className={cn(fieldClassName, layout === "stack" && "col-span-full")}
        >
          <DocumentLayoutLabel
            htmlFor={isRail ? "po-internal-notes-rail" : "po-internal-notes"}
            field={getPoLayoutColumnPref(documentLayout, "internal_notes")}
            fallbackLabel="Internal notes"
          />
          <Input
            id={isRail ? "po-internal-notes-rail" : "po-internal-notes"}
            disabled={disabled}
            value={form.custom_fields.internal_notes}
            onChange={(event) =>
              onPatch({
                custom_fields: {
                  ...form.custom_fields,
                  internal_notes: event.target.value,
                },
              })
            }
          />
        </div>
      );
    default:
      return null;
  }
}

export function PoDetailsPanel({
  form,
  disabled = false,
  layout = "stack",
  className,
  documentLayout = DEFAULT_PO_SCREEN_LAYOUT,
  onPatch,
}: Props) {
  const isRail = layout === "rail";
  const detailFields = getVisiblePoFormHeaderDetailsFields(documentLayout);

  if (detailFields.length === 0) return null;

  const grid = resolvePoFormFieldsGridProps(detailFields.length, isRail);

  return (
    <div className={cn("surface-inset min-w-0 p-4", className)}>
      <div className={grid.containerClassName}>
        <div className={cn("gap-4", grid.gridClassName)}>
          {detailFields.map((field, index) =>
            renderDetailsField(field, {
              form,
              disabled,
              layout,
              documentLayout,
              onPatch,
            }, index, detailFields)
          )}
        </div>
      </div>
    </div>
  );
}
