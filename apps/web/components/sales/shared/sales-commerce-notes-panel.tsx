"use client";

import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import {
  DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  getSalesLayoutColumnPref,
} from "@/lib/sales/shared/sales-commerce-layout";
import { getVisibleSalesFormHeaderNotesField } from "@/lib/sales/shared/sales-form-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

type Props<TForm extends { custom_fields: { internal_notes?: string } }> = {
  form: TForm;
  disabled?: boolean;
  className?: string;
  documentLayout?: DocumentLayoutTemplate;
  onPatch: (patch: Partial<TForm>) => void;
};

export function SalesCommerceNotesPanel<TForm extends { custom_fields: { internal_notes?: string } }>({
  form,
  disabled = false,
  className,
  documentLayout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  onPatch,
}: Props<TForm>) {
  const notesField = getVisibleSalesFormHeaderNotesField(documentLayout);
  if (!notesField) return null;

  const columnPref = getSalesLayoutColumnPref(documentLayout, "internal_notes");
  const inputId = "sales-internal-notes";

  return (
    <div className={cn("surface-inset min-w-0 p-3", className)}>
      <DocumentLayoutLabel
        htmlFor={inputId}
        field={columnPref}
        fallbackLabel="Notes"
        defaultClassName="sr-only"
      />
      <textarea
        id={inputId}
        rows={3}
        disabled={disabled}
        value={form.custom_fields.internal_notes ?? ""}
        placeholder="Internal notes"
        aria-label={columnPref?.label ?? "Notes"}
        onChange={(event) =>
          onPatch({
            custom_fields: {
              ...form.custom_fields,
              internal_notes: event.target.value,
            },
          } as Partial<TForm>)
        }
        className={cn(
          "flex min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-white px-2 py-1.5 text-xs shadow-sm",
          "po-line-cell-surface ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[hsl(224_47%_14%)]"
        )}
      />
    </div>
  );
}
