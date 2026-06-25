const BLANK_DISPLAY_VALUES = new Set(["—", "–", "-"]);

/** True when a matrix cell or field has no meaningful value to show. */
export function isBlankMatrixDisplayValue(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return BLANK_DISPLAY_VALUES.has(trimmed);
}
