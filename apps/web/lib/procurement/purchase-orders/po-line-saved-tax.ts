import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";

const TAX_RATE_TOLERANCE = 0.0001;

export function resolveTaxCodeIdForRate(
  rate: number,
  options: readonly PoLineTaxCodeOption[]
): string | null {
  if (!Number.isFinite(rate) || rate < 0) return null;
  const match = options.find(
    (entry) => !entry.is_variable && Math.abs(Number(entry.rate) - rate) <= TAX_RATE_TOLERANCE
  );
  return match?.id ?? null;
}

export function isPoLineSavedTaxSnapshot(
  context: PoLineCatalogContext | null | undefined
): boolean {
  return (
    context?.catalog_snapshot_source === "optimistic" &&
    Number.isFinite(context.tax_rate) &&
    context.tax_rate >= 0
  );
}

export function mapSavedPoLineTaxComponents(
  components: PurchaseOrderLineRow["tax_components"]
): PoLineCatalogContext["tax_components"] {
  return components.map((component, index) => ({
    name: component.name,
    rate: component.rate,
    sort_order: index,
  }));
}

/** Keep tax % from a saved PO line after item catalog hydration. */
export function mergeSavedPoLineTaxIntoCatalog(
  saved: PoLineCatalogContext,
  catalog: PoLineCatalogContext,
  taxCodeOptions: readonly PoLineTaxCodeOption[] = []
): PoLineCatalogContext {
  const savedRate = saved.tax_rate;
  if (!Number.isFinite(savedRate) || savedRate < 0) return catalog;

  let tax_code_id = saved.tax_code_id?.trim() || null;
  if (!tax_code_id) {
    if (
      catalog.tax_code_id &&
      Math.abs(Number(catalog.tax_rate) - savedRate) <= TAX_RATE_TOLERANCE
    ) {
      tax_code_id = catalog.tax_code_id;
    } else {
      tax_code_id = resolveTaxCodeIdForRate(savedRate, taxCodeOptions);
    }
  }

  const selected = tax_code_id
    ? taxCodeOptions.find((entry) => entry.id === tax_code_id)
    : null;

  return {
    ...catalog,
    tax_rate: savedRate,
    tax_code_id,
    tax_is_variable: selected?.is_variable ?? saved.tax_is_variable ?? catalog.tax_is_variable,
    tax_components: selected
      ? selected.components.map((component) => ({ ...component }))
      : saved.tax_components.length > 0
        ? saved.tax_components
        : catalog.tax_components,
    catalog_snapshot_source: "server",
  };
}

export function enrichDraftLineWithSavedPoTax(
  line: PoDraftLine,
  taxCodeOptions: readonly PoLineTaxCodeOption[]
): PoDraftLine {
  if (!line.catalog_context || !isPoLineSavedTaxSnapshot(line.catalog_context)) {
    return line;
  }

  return {
    ...line,
    catalog_context: mergeSavedPoLineTaxIntoCatalog(
      line.catalog_context,
      line.catalog_context,
      taxCodeOptions
    ),
  };
}

export function enrichDraftLinesWithSavedPoTax(
  lines: PoDraftLine[],
  taxCodeOptions: readonly PoLineTaxCodeOption[]
): PoDraftLine[] {
  return lines.map((line) => enrichDraftLineWithSavedPoTax(line, taxCodeOptions));
}

export function applySavedPoTaxToDraftForm<
  T extends { lines: PoDraftLine[] },
>(draft: T, taxCodeOptions: readonly PoLineTaxCodeOption[]): T {
  return {
    ...draft,
    lines: enrichDraftLinesWithSavedPoTax(draft.lines, taxCodeOptions),
  };
}
