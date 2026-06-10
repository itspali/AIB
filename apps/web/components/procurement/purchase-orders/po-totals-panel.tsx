"use client";

import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getVisibleTotalsFields,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import { resolveColumnDecimalPlaces } from "@/lib/documents/decimal-format";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import {
  computePurchaseOrderTotals,
  formatPoMoney,
  type PurchaseOrderTotalsSnapshot,
} from "@/lib/procurement/purchase-orders/totals";
import { filterSavablePoLines, type PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { cn } from "@/lib/utils";

type Props = {
  lines: PoDraftLine[];
  className?: string;
  layout?: DocumentLayoutTemplate;
  layoutMode?: "rail" | "footer" | "embedded";
  showSectionTitle?: boolean;
  /** Keep footer totals visible on large viewports (narrow 40vw drawer). */
  showFooterOnLarge?: boolean;
  purchasePricesTaxInclusive?: boolean;
};

function resolveTotalsValue(field: DocumentColumnPref, totals: PurchaseOrderTotalsSnapshot): string {
  const decimalPlaces = resolveColumnDecimalPlaces(field);
  switch (field.id) {
    case "line_count":
      return String(totals.filledLineCount);
    case "subtotal_ex_tax":
      return formatPoMoney(totals.subtotalGross, decimalPlaces);
    case "tax_amount":
      return formatPoMoney(totals.taxAmount, decimalPlaces);
    case "grand_total":
      return formatPoMoney(totals.grandTotal, decimalPlaces);
    default:
      return "—";
  }
}

function TotalsFieldRow({
  field,
  totals,
}: {
  field: DocumentColumnPref;
  totals: PurchaseOrderTotalsSnapshot;
}) {
  const isGrandTotal = field.id === "grand_total";

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
          isGrandTotal ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {field.label}
      </dt>
      <dd
        className={documentFieldTypographyClassName(
          field,
          cn(
            "tabular-nums",
            isGrandTotal
              ? "text-base font-semibold text-foreground"
              : field.id === "tax_amount"
                ? "font-medium text-muted-foreground"
                : "font-medium text-foreground"
          )
        )}
      >
        {resolveTotalsValue(field, totals)}
      </dd>
    </div>
  );
}

function TotalsBody({
  totals,
  fields,
}: {
  totals: PurchaseOrderTotalsSnapshot;
  fields: DocumentColumnPref[];
}) {
  return (
    <dl className="space-y-2 text-sm">
      {fields.map((field) => (
        <TotalsFieldRow key={field.id} field={field} totals={totals} />
      ))}
    </dl>
  );
}

function TotalsCard({
  totals,
  fields,
  className,
}: {
  totals: PurchaseOrderTotalsSnapshot;
  fields: DocumentColumnPref[];
  className?: string;
}) {
  return (
    <div className={cn("surface-inset p-4", className)}>
      <TotalsBody totals={totals} fields={fields} />
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
}: Props) {
  const resolvedLayout = normalizePoLayoutTemplate(layout);
  const visibleTotalsFields = getVisibleTotalsFields(resolvedLayout);
  const totals = computePurchaseOrderTotals(filterSavablePoLines(lines), {
    purchasePricesTaxInclusive,
  });

  if (layoutMode === "embedded") {
    return <TotalsCard totals={totals} fields={visibleTotalsFields} className={className} />;
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
        <TotalsBody totals={totals} fields={visibleTotalsFields} />
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
      <TotalsCard totals={totals} fields={visibleTotalsFields} />
    </aside>
  );
}
