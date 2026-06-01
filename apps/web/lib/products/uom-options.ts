export const UOM_OPTIONS = ["PCS", "KG", "LTRS", "BOX"] as const;

export type UomCode = (typeof UOM_OPTIONS)[number];

export function isUomCode(value: string): value is UomCode {
  return (UOM_OPTIONS as readonly string[]).includes(value);
}

export type UomOption = { code: string; name: string };

/**
 * Resolves the unit options a product form should offer. Prefers the tenant's
 * managed units of measure; falls back to the built-in defaults when none have
 * been configured yet so the picker is never empty.
 */
export function resolveUomOptions(
  managed: ReadonlyArray<{ code: string; name: string }> | null | undefined
): UomOption[] {
  if (managed && managed.length > 0) {
    return managed.map((unit) => ({ code: unit.code, name: unit.name }));
  }
  return UOM_OPTIONS.map((code) => ({ code, name: code }));
}

/**
 * Ensures a currently-selected code is always present in the option list, even
 * if it was deactivated or renamed since the item was last saved.
 */
export function withUomValue(
  options: UomOption[],
  current: string | null | undefined
): UomOption[] {
  if (!current) return options;
  if (options.some((option) => option.code === current)) return options;
  return [...options, { code: current, name: current }];
}

/** Stock unit plus catalog alternate UOMs (for default sales / purchase unit pickers). */
export function resolveItemCommerceUomOptions(
  stockUom: string,
  alternateUoms: ReadonlyArray<{ uom_code: string }>,
  managed: ReadonlyArray<{ code: string; name: string }> | null | undefined,
  current?: string | null
): UomOption[] {
  const tenantByCode = new Map(resolveUomOptions(managed).map((unit) => [unit.code, unit]));
  const codes: string[] = [];
  const trimmedStock = stockUom.trim();
  if (trimmedStock) codes.push(trimmedStock);
  for (const row of alternateUoms) {
    const code = row.uom_code?.trim();
    if (code && code !== trimmedStock && !codes.includes(code)) {
      codes.push(code);
    }
  }
  const options = codes.map((code) => tenantByCode.get(code) ?? { code, name: code });
  return withUomValue(options, current);
}
