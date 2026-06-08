"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

export function PoDetailsPanel({
  form,
  disabled = false,
  layout = "stack",
  stackVertically = false,
  className,
  onPatch,
}: Props) {
  const isRail = layout === "rail";
  const singleColumn = isRail || stackVertically;

  return (
    <div className={cn("surface-inset min-w-0 p-4", className)}>
      <div className={cn("grid gap-4", singleColumn ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
        <div className="space-y-2">
          <Label htmlFor={isRail ? "po-payment-terms-rail" : "po-payment-terms"}>
            Payment terms (days)
          </Label>
          <Input
            id={isRail ? "po-payment-terms-rail" : "po-payment-terms"}
            inputMode="numeric"
            disabled={disabled}
            value={form.payment_terms_days}
            onChange={(event) => onPatch({ payment_terms_days: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={isRail ? "po-requisition-rail" : "po-requisition"}>
            Requisition #
          </Label>
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
        <div className="space-y-2">
          <Label htmlFor={isRail ? "po-delivery-date-rail" : "po-delivery-date"}>
            Expected delivery
          </Label>
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
        <div className={cn("space-y-2", !singleColumn && "md:col-span-2")}>
          <Label htmlFor={isRail ? "po-internal-notes-rail" : "po-internal-notes"}>
            Internal notes
          </Label>
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
      </div>
    </div>
  );
}
