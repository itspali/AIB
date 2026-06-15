import { normalizeDocumentDecimalInput } from "@/lib/documents/decimal-format";

export type LineUomOption = {
  uom_code: string;
  conversion_factor: number;
};

function trimCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function parseUnitPrice(value: string): number | null {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Conversion factor for a UOM code (base unit = 1). */
export function resolveLineUomConversionFactorForCode(
  options: ReadonlyArray<LineUomOption>,
  uomCode: string | null | undefined
): number {
  const code = trimCode(uomCode);
  if (!code) return 1;
  const match = options.find((option) => option.uom_code === code);
  return match?.conversion_factor ?? 1;
}

/**
 * Scale a catalog/base-unit price to the target line UOM (pack-price model).
 * Example: ₹10/PC → BOX (×2) → ₹20/Box.
 */
export function scaleCatalogBaseUnitPriceToLineUom(
  baseUnitPrice: string,
  targetUomCode: string | null | undefined,
  options: ReadonlyArray<LineUomOption>,
  decimalPlaces = 2
): string {
  const factor = resolveLineUomConversionFactorForCode(options, targetUomCode);
  if (factor === 1) return baseUnitPrice;

  const parsed = parseUnitPrice(baseUnitPrice);
  if (parsed == null) return baseUnitPrice;

  return normalizeDocumentDecimalInput(String(parsed * factor), decimalPlaces);
}

/**
 * Rescale unit price when the user switches line UOM, preserving economic value.
 * Example: ₹10/PC → BOX (×2) → ₹20/Box; reverse → ₹10/PC.
 */
export function rescaleUnitPriceBetweenUoms(
  unitPrice: string,
  fromUomCode: string | null | undefined,
  toUomCode: string | null | undefined,
  options: ReadonlyArray<LineUomOption>,
  decimalPlaces = 2
): string {
  const fromFactor = resolveLineUomConversionFactorForCode(options, fromUomCode);
  const toFactor = resolveLineUomConversionFactorForCode(options, toUomCode);
  if (fromFactor === toFactor) return unitPrice;

  const parsed = parseUnitPrice(unitPrice);
  if (parsed == null) return unitPrice;

  const rescaled = parsed * (toFactor / fromFactor);
  return normalizeDocumentDecimalInput(String(rescaled), decimalPlaces);
}
