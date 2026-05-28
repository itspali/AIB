export const TAX_CATEGORY_OPTIONS = [
  "STANDARD",
  "REDUCED",
  "ZERO_RATED",
  "EXEMPT",
] as const;

export type TaxCategory = (typeof TAX_CATEGORY_OPTIONS)[number];

export function isTaxCategory(value: string): value is TaxCategory {
  return (TAX_CATEGORY_OPTIONS as readonly string[]).includes(value);
}

export function taxCategoryLabel(value: TaxCategory): string {
  switch (value) {
    case "STANDARD":
      return "Standard rate";
    case "REDUCED":
      return "Reduced rate";
    case "ZERO_RATED":
      return "Zero rated";
    case "EXEMPT":
      return "Exempt";
    default:
      return value;
  }
}
