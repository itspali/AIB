import { COMMERCE_DEFAULT_SELLING_UOM_KEY } from "@/lib/products/item-uom-commerce";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import {
  rescaleUnitPriceBetweenUoms,
  scaleCatalogBaseUnitPriceToLineUom,
} from "@/lib/documents/line-uom-unit-price";
import { PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES } from "@/lib/procurement/purchase-orders/supplier-price";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";
export type SalesLineUomOption = {
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

/** Build orderable UOM options for a sales line (base + alternates). */
export function buildSalesLineUomOptions(input: {
  base_unit_of_measure: string | null | undefined;
  alternate_uoms?: ReadonlyArray<{ uom_code: string; conversion_factor: number | string }>;
  default_selling_uom?: string | null;
}): SalesLineUomOption[] {
  const base = trimCode(input.base_unit_of_measure);
  if (!base) return [];

  const byCode = new Map<string, SalesLineUomOption>();
  byCode.set(base, { uom_code: base, conversion_factor: 1 });

  for (const row of input.alternate_uoms ?? []) {
    const code = trimCode(row.uom_code);
    if (!code || code === base) continue;
    byCode.set(code, {
      uom_code: code,
      conversion_factor: parseFactor(row.conversion_factor),
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

export function buildSalesLineCatalogUomOptions(
  context: Pick<
    PoLineCatalogContext,
    "base_unit_of_measure" | "alternate_uoms" | "default_selling_uom"
  > | null | undefined
): SalesLineUomOption[] {
  if (!context) return [];
  return buildSalesLineUomOptions({
    base_unit_of_measure: context.base_unit_of_measure,
    alternate_uoms: context.alternate_uoms,
    default_selling_uom: context.default_selling_uom,
  });
}

export function resolveDefaultSalesLineUomCode(
  context: Pick<
    PoLineCatalogContext,
    "base_unit_of_measure" | "default_selling_uom" | "alternate_uoms"
  > | null | undefined
): string {
  const options = buildSalesLineCatalogUomOptions(context);
  const base = options[0]?.uom_code ?? trimCode(context?.base_unit_of_measure) ?? "";
  const preferred = trimCode(context?.default_selling_uom);
  if (preferred && options.some((option) => option.uom_code === preferred)) {
    return preferred;
  }
  return base;
}

/** Pick line UOM after catalog hydration (mirrors PO purchase-default upgrade). */
export function resolveSalesLineUomAfterCatalogUpdate(
  existingUom: string | null | undefined,
  context: PoLineCatalogContext | null | undefined
): string {
  const options = buildSalesLineCatalogUomOptions(context);
  const defaultCode = resolveDefaultSalesLineUomCode(context);
  const base = trimCode(context?.base_unit_of_measure) ?? options[0]?.uom_code ?? "";
  const trimmed = trimCode(existingUom);

  if (trimmed && options.some((option) => option.uom_code === trimmed)) {
    if (trimmed === defaultCode) return trimmed;
    if (trimmed === base && defaultCode !== base) return defaultCode;
    return trimmed;
  }

  return defaultCode || base;
}

export function resolveSalesLineUomOptions(
  line: Pick<SalesCommerceLineBase, "catalog_context">
): SalesLineUomOption[] {
  return buildSalesLineCatalogUomOptions(line.catalog_context);
}

export function canEditSalesLineUom(line: Pick<SalesCommerceLineBase, "variant_id" | "catalog_context">): boolean {
  return Boolean(line.variant_id) && resolveSalesLineUomOptions(line).length > 1;
}

export function resolveSalesDraftLineUomCode(
  line: Pick<SalesCommerceLineBase, "catalog_context" | "uom_code" | "base_unit_of_measure">
): string | null {
  const options = resolveSalesLineUomOptions(line);
  const base =
    trimCode(line.catalog_context?.base_unit_of_measure) ??
    trimCode(line.base_unit_of_measure) ??
    options[0]?.uom_code ??
    null;
  const trimmed = trimCode(line.uom_code);

  if (trimmed && options.some((option) => option.uom_code === trimmed)) {
    return trimmed;
  }

  if (!options.length) {
    return base ?? trimmed;
  }

  const fallback = resolveDefaultSalesLineUomCode(line.catalog_context);
  return fallback || base || null;
}

/** UOM sent to save_sales_* — only registered alternates, omit when base. */
export function resolveSalesDraftLineUomCodeForSave(
  line: Pick<SalesCommerceLineBase, "catalog_context" | "uom_code" | "base_unit_of_measure">
): string | undefined {
  const code = resolveSalesDraftLineUomCode(line);
  if (!code) return undefined;

  const base =
    trimCode(line.catalog_context?.base_unit_of_measure) ?? trimCode(line.base_unit_of_measure);
  if (base && code === base) return undefined;

  const alternates = line.catalog_context?.alternate_uoms ?? [];
  if (alternates.some((row) => trimCode(row.uom_code) === code)) {
    return code;
  }

  return undefined;
}

export function resolveSalesLineUomConversionFactor(
  line: Pick<SalesCommerceLineBase, "catalog_context" | "uom_code" | "base_unit_of_measure">
): number {
  const code = resolveSalesDraftLineUomCode(line);
  if (!code) return 1;
  const match = resolveSalesLineUomOptions(line).find((option) => option.uom_code === code);
  return match?.conversion_factor ?? 1;
}

/** Patch fields when the user picks a different line UOM (rescales selling unit price). */
export function buildSalesDraftLineUomChangePatch<T extends SalesCommerceLineBase>(
  line: T,
  nextUomCode: string
): Pick<T, "uom_code" | "unit_price_selling"> {
  const currentUom = resolveSalesDraftLineUomCode(line);
  const normalizedNext = trimCode(nextUomCode) ?? nextUomCode;
  if (!currentUom || normalizedNext === currentUom) {
    return { uom_code: normalizedNext } as Pick<T, "uom_code" | "unit_price_selling">;
  }

  const options = resolveSalesLineUomOptions(line);
  return {
    uom_code: normalizedNext,
    unit_price_selling: rescaleUnitPriceBetweenUoms(
      line.unit_price_selling,
      currentUom,
      normalizedNext,
      options,
      PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES
    ),
  } as Pick<T, "uom_code" | "unit_price_selling">;
}

/** Scale catalog/base-unit selling rate to the line's order UOM. */
export function scaleSalesCatalogBaseUnitPriceToLineUom(
  baseUnitPrice: string,
  line: Pick<SalesCommerceLineBase, "catalog_context" | "uom_code" | "base_unit_of_measure">
): string {
  const options = resolveSalesLineUomOptions(line);
  const targetUom = resolveSalesDraftLineUomCode(line) ?? line.uom_code;
  return scaleCatalogBaseUnitPriceToLineUom(
    baseUnitPrice,
    targetUom,
    options,
    PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES
  );
}

/** Rescale selling unit price when UOM changes during catalog hydration. */
export function applySalesDraftLineUomTransition<T extends SalesCommerceLineBase>(
  line: T,
  nextUomCode: string | null | undefined
): T {
  const previousUom = resolveSalesDraftLineUomCode(line);
  const normalizedNext = trimCode(nextUomCode) ?? previousUom;
  if (!normalizedNext || !previousUom || normalizedNext === previousUom) {
    return { ...line, uom_code: normalizedNext ?? line.uom_code };
  }

  const options = resolveSalesLineUomOptions(line);
  return {
    ...line,
    uom_code: normalizedNext,
    unit_price_selling: rescaleUnitPriceBetweenUoms(
      line.unit_price_selling,
      previousUom,
      normalizedNext,
      options,
      PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES
    ),
  };
}

function formatConversionQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(6).replace(/\.?0+$/, "");
}

export type UomConversionHintStyle = "ratio" | "parenthetical";

function formatUomConversionHint(input: {
  uomCode: string;
  baseUom: string;
  factor: number;
  quantity?: string;
  style?: UomConversionHintStyle;
}): string | null {
  const { uomCode, baseUom, factor } = input;
  if (!uomCode || !baseUom || uomCode === baseUom || factor === 1) return null;

  const qty = Number((input.quantity ?? "").trim());
  if (Number.isFinite(qty) && qty > 0) {
    return `(${formatConversionQuantity(qty * factor)} ${baseUom})`;
  }
  if (input.style === "parenthetical") {
    return `(${formatConversionQuantity(factor)} ${baseUom})`;
  }
  return `1 ${uomCode} = ${formatConversionQuantity(factor)} ${baseUom}`;
}

export function formatSalesLineUomConversionHint(
  line: Pick<SalesCommerceLineBase, "catalog_context" | "uom_code" | "base_unit_of_measure">,
  quantity: string,
  options?: { style?: UomConversionHintStyle }
): string | null {
  const uomCode = resolveSalesDraftLineUomCode(line);
  const baseUom = trimCode(line.catalog_context?.base_unit_of_measure) ?? trimCode(line.base_unit_of_measure);
  if (!uomCode || !baseUom) return null;
  return formatUomConversionHint({
    uomCode,
    baseUom,
    factor: resolveSalesLineUomConversionFactor(line),
    quantity,
    style: options?.style,
  });
}

export function formatSalesPeekLineUomConversionHint(input: {
  uom_code?: string | null;
  base_unit_of_measure?: string | null;
  uom_conversion_factor?: number | string | null;
  quantity?: string;
}): string | null {
  const uomCode = trimCode(input.uom_code) ?? trimCode(input.base_unit_of_measure);
  const baseUom = trimCode(input.base_unit_of_measure);
  if (!uomCode || !baseUom) return null;
  return formatUomConversionHint({
    uomCode,
    baseUom,
    factor: parseFactor(input.uom_conversion_factor),
    quantity: input.quantity,
  });
}

export function parseDefaultSellingUomFromCustomFields(
  customFields: Record<string, unknown> | null | undefined
): string | null {
  if (!customFields) return null;
  const raw = customFields[COMMERCE_DEFAULT_SELLING_UOM_KEY];
  return typeof raw === "string" ? trimCode(raw) : null;
}
