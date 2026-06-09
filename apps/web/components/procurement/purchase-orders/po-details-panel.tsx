"use client";

import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLayoutColumnPref,
  isPoHeaderFieldVisible,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import { cn } from "@/lib/utils";

type Props = {
  form: PoDraftFormState;
  disabled?: boolean;
  /** Single column for the right rail; responsive grid when stacked above lines on mobile. */
  layout?: "rail" | "stack";
  /** Force single column in narrow (40vw) drawer peek. */
  stackVertically?: boolean;
  className?: string;
  documentLayout?: DocumentLayoutTemplate;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

export function PoDetailsPanel({
  form,
  disabled = false,
  layout = "stack",
  stackVertically = false,
  className,
  documentLayout = DEFAULT_PO_SCREEN_LAYOUT,
  onPatch,
}: Props) {
  const isRail = layout === "rail";
  const singleColumn = isRail || stackVertically;

  const showPaymentTerms = isPoHeaderFieldVisible("payment_terms_days", documentLayout);
  const showRequisition = isPoHeaderFieldVisible("requisition_number", documentLayout);
  const showDeliveryDate = isPoHeaderFieldVisible("expected_delivery_date", documentLayout);
  const showInternalNotes = isPoHeaderFieldVisible("internal_notes", documentLayout);

  const visibleCount = [
    showPaymentTerms,
    showRequisition,
    showDeliveryDate,
    showInternalNotes,
  ].filter(Boolean).length;

  if (visibleCount === 0) return null;

  return (
    <div className={cn("surface-inset min-w-0 p-4", className)}>
      <div
        className={cn(
          "grid gap-4",
          singleColumn ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
        )}
      >
        {showPaymentTerms ? (
          <div className="space-y-2">
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
        ) : null}

        {showRequisition ? (
          <div className="space-y-2">
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
        ) : null}

        {showDeliveryDate ? (
          <div className="space-y-2">
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
        ) : null}

        {showInternalNotes ? (
          <div className={cn("space-y-2", !singleColumn && "md:col-span-2")}>
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
        ) : null}
      </div>
    </div>
  );
}
