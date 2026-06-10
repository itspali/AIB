import { COMMERCE_DEFAULT_PURCHASE_UOM_KEY } from "@/lib/products/item-uom-commerce";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

export type PoLineUomOption = {
  uom_code: string;
  conversion_factor: number;
};

function trimCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function parseFactor(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Build orderable UOM options for a PO line (base + alternates). */
export function buildPoLineUomOptions(input: {
  base_unit_of_measure: string | null | undefined;
  alternate_uoms?: ReadonlyArray<{ uom_code: string; conversion_factor: number | string }>;
  default_purchase_uom?: string | null;
}): PoLineUomOption[] {
  const base = trimCode(input.base_unit_of_measure);
  if (!base) return [];

  const byCode = new Map<string, PoLineUomOption>();
  byCode.set(base, { uom_code: base, conversion_factor: 1 });

  for (const row of input.alternate_uoms ?? []) {
    const code = trimCode(row.uom_code);
    if (!code || code === base) continue;
    byCode.set(code, {
      uom_code: code,
      conversion_factor: parseFactor(row.conversion_factor),
    });
  }

  const purchaseUom = trimCode(input.default_purchase_uom);
  if (purchaseUom && purchaseUom !== base && !byCode.has(purchaseUom)) {
    const fromAlternates = input.alternate_uoms?.find((row) => trimCode(row.uom_code) === purchaseUom);
    byCode.set(purchaseUom, {
      uom_code: purchaseUom,
      conversion_factor: fromAlternates
        ? parseFactor(fromAlternates.conversion_factor)
        : 1,
    });
  }

  const options = [...byCode.values()];
  options.sort((a, b) => {
    if (a.uom_code === base) return -1;
    if (b.uom_code === base) return 1;
    return a.uom_code.localeCompare(b.uom_code);
  });
  return options;
}

export function buildPoLineCatalogUomOptions(
  context: Pick<
    PoLineCatalogContext,
    "base_unit_of_measure" | "alternate_uoms" | "default_purchase_uom"
  > | null | undefined
): PoLineUomOption[] {
  if (!context) return [];
  return buildPoLineUomOptions({
    base_unit_of_measure: context.base_unit_of_measure,
    alternate_uoms: context.alternate_uoms,
    default_purchase_uom: context.default_purchase_uom,
  });
}

export function resolveDefaultPoLineUomCode(
  context: Pick<
    PoLineCatalogContext,
    "base_unit_of_measure" | "default_purchase_uom" | "alternate_uoms"
  > | null | undefined
): string {
  const options = buildPoLineCatalogUomOptions(context);
  const base = options[0]?.uom_code ?? trimCode(context?.base_unit_of_measure) ?? "";
  const preferred = trimCode(context?.default_purchase_uom);
  if (preferred && options.some((option) => option.uom_code === preferred)) {
    return preferred;
  }
  return base;
}

/**
 * Pick the line UOM after catalog hydration. Upgrades an implicit base-unit default
 * to the item's purchase default when the server snapshot arrives; keeps explicit
 * non-base choices (e.g. user picked a different alternate).
 */
export function resolvePoLineUomAfterCatalogUpdate(
  existingUom: string | null | undefined,
  context: PoLineCatalogContext | null | undefined
): string {
  const options = buildPoLineCatalogUomOptions(context);
  const defaultCode = resolveDefaultPoLineUomCode(context);
  const base = trimCode(context?.base_unit_of_measure) ?? options[0]?.uom_code ?? "";
  const trimmed = trimCode(existingUom);

  if (trimmed && options.some((option) => option.uom_code === trimmed)) {
    if (trimmed === defaultCode) return trimmed;
    if (trimmed === base && defaultCode !== base) return defaultCode;
    return trimmed;
  }

  return defaultCode || base;
}

export function resolvePoLineUomOptions(line: PoDraftLine): PoLineUomOption[] {
  return buildPoLineCatalogUomOptions(line.catalog_context);
}

export function canEditPoLineUom(line: PoDraftLine): boolean {
  return Boolean(line.variant_id) && resolvePoLineUomOptions(line).length > 1;
}

export function resolvePoDraftLineUomCode(line: PoDraftLine): string | null {
  const trimmed = trimCode(line.uom_code);
  const options = resolvePoLineUomOptions(line);
  if (trimmed && options.some((option) => option.uom_code === trimmed)) {
    return trimmed;
  }
  if (trimmed && !options.length) return trimmed;
  const fallback = resolveDefaultPoLineUomCode(line.catalog_context);
  return fallback || null;
}

export function resolvePoLineUomConversionFactor(line: PoDraftLine): number {
  const code = resolvePoDraftLineUomCode(line);
  if (!code) return 1;
  const match = resolvePoLineUomOptions(line).find((option) => option.uom_code === code);
  return match?.conversion_factor ?? 1;
}

function formatConversionQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(6).replace(/\.?0+$/, "");
}

function formatUomConversionHint(input: {
  uomCode: string;
  baseUom: string;
  factor: number;
  quantityOrdered?: string;
}): string | null {
  const { uomCode, baseUom, factor } = input;
  if (!uomCode || !baseUom || uomCode === baseUom || factor === 1) return null;

  const qty = Number((input.quantityOrdered ?? "").trim());
  if (Number.isFinite(qty) && qty > 0) {
    return `(${formatConversionQuantity(qty * factor)} ${baseUom})`;
  }
  return `1 ${uomCode} = ${formatConversionQuantity(factor)} ${baseUom}`;
}

/** Hint for PO qty column when line UOM differs from item base (ratio or base equivalent). */
export function formatPoLineUomConversionHint(line: PoDraftLine): string | null {
  const uomCode = resolvePoDraftLineUomCode(line);
  const baseUom = trimCode(line.catalog_context?.base_unit_of_measure);
  if (!uomCode || !baseUom) return null;
  return formatUomConversionHint({
    uomCode,
    baseUom,
    factor: resolvePoLineUomConversionFactor(line),
    quantityOrdered: line.quantity_ordered,
  });
}

export function formatPoPeekLineUomConversionHint(line: PurchaseOrderLineRow): string | null {
  const uomCode = resolvePoPeekLineUomCode(line);
  const baseUom = trimCode(line.base_unit_of_measure);
  if (!uomCode || !baseUom) return null;
  return formatUomConversionHint({
    uomCode,
    baseUom,
    factor: parseFactor(line.uom_conversion_factor),
    quantityOrdered: line.quantity_ordered,
  });
}

export function resolvePoPeekLineUomCode(line: PurchaseOrderLineRow): string | null {
  return trimCode(line.uom_code) ?? trimCode(line.base_unit_of_measure);
}

export function resolvePoLineUnitCodeFromCatalog(
  context: PoLineCatalogContext | null | undefined
): string | null {
  return trimCode(context?.base_unit_of_measure);
}

export function parseDefaultPurchaseUomFromCustomFields(
  customFields: Record<string, unknown> | null | undefined
): string | null {
  if (!customFields) return null;
  const raw = customFields[COMMERCE_DEFAULT_PURCHASE_UOM_KEY];
  return typeof raw === "string" ? trimCode(raw) : null;
}
