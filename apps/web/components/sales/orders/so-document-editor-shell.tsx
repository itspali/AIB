"use client";

import type { RightDrawerLayoutValue } from "@/components/ui/right-drawer";
import { SoFormHeader } from "@/components/sales/orders/so-form-header";
import { SoLineEntryTable } from "@/components/sales/orders/so-line-entry-table";
import { SoTotalsPanel } from "@/components/sales/orders/so-totals-panel";
import type { SoDraftFormState } from "@/lib/sales/orders/draft-form";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { cn } from "@/lib/utils";

export const SO_FULL_PAGE_LAYOUT: RightDrawerLayoutValue = {
  widthVw: 100,
  isPartialDrawer: false,
};

export type SoDocumentEditorShellProps = {
  form: SoDraftFormState;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  defaultCurrency: string;
  allowLineItemDiscounts?: boolean;
  isPending: boolean;
  onPatch: (patch: Partial<SoDraftFormState>) => void;
  onLinesChange: (
    linesOrUpdater:
      | SoDraftFormState["lines"]
      | ((current: SoDraftFormState["lines"]) => SoDraftFormState["lines"])
  ) => void;
};

export function SoDocumentEditorShell({
  form,
  locations,
  customers,
  defaultCurrency,
  allowLineItemDiscounts = true,
  isPending,
  onPatch,
  onLinesChange,
}: SoDocumentEditorShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <SoFormHeader
        form={form}
        locations={locations}
        customers={customers}
        disabled={isPending}
        onPatch={onPatch}
      />

      <div className="min-h-0 flex-1 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lines</p>
        <div className={cn("min-h-0 overflow-auto")}>
          <SoLineEntryTable
            lines={form.lines}
            disabled={isPending}
            allowLineItemDiscounts={allowLineItemDiscounts}
            onChange={onLinesChange}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div />
        <SoTotalsPanel lines={form.lines} currencyCode={defaultCurrency} />
      </div>
    </div>
  );
}
