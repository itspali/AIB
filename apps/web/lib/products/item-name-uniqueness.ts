export const EXACT_DUPLICATE_ITEM_NAME_MESSAGE =
  "An item with this name already exists in your workspace.";

/** Case-insensitive tenant-wide name equality for duplicate checks. */
export function normalizeItemNameForComparison(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function itemNamesMatchTenantWide(left: string, right: string): boolean {
  const a = normalizeItemNameForComparison(left);
  const b = normalizeItemNameForComparison(right);
  return a.length > 0 && a === b;
}
