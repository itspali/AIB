/** True when a stored/form dimension string carries a positive value. */
export function hasPositiveDimension(value: string | null | undefined): boolean {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "0") return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}

/** True when any package dimension or weight field is set on the item master. */
export function itemHasShippingDimensions(input: {
  dead_weight_kg?: string | null;
  length_cm?: string | null;
  width_cm?: string | null;
  height_cm?: string | null;
}): boolean {
  return (
    hasPositiveDimension(input.dead_weight_kg) ||
    hasPositiveDimension(input.length_cm) ||
    hasPositiveDimension(input.width_cm) ||
    hasPositiveDimension(input.height_cm)
  );
}

/** Prefer an explicit value; otherwise inherit the master/default row. */
export function resolveShippingDimensionDefault(
  own: string | null | undefined,
  fallback: string | null | undefined
): string | undefined {
  if (hasPositiveDimension(own)) return String(own).trim();
  if (hasPositiveDimension(fallback)) return String(fallback).trim();
  const ownTrimmed = String(own ?? "").trim();
  if (ownTrimmed) return ownTrimmed;
  const fallbackTrimmed = String(fallback ?? "").trim();
  return fallbackTrimmed || undefined;
}

/** Positive cm dimension from form text; 0 when empty or invalid. */
export function parseDimensionCm(value: string | null | undefined): number {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Volume in cm³ from L×W×H (cm). Empty string when any side is missing. */
export function computeVolumeCm3FromDimensions(
  lengthCm: string | null | undefined,
  widthCm: string | null | undefined,
  heightCm: string | null | undefined
): string {
  const length = parseDimensionCm(lengthCm);
  const width = parseDimensionCm(widthCm);
  const height = parseDimensionCm(heightCm);
  if (length <= 0 || width <= 0 || height <= 0) return "";

  const volume = length * width * height;
  const formatted =
    volume >= 1
      ? volume.toFixed(4).replace(/\.?0+$/, "")
      : volume.toFixed(6).replace(/\.?0+$/, "");
  return formatted || "0";
}

/** User-facing line for calculated volume (read-only). */
export function formatCalculatedVolumeInfo(
  lengthCm: string | null | undefined,
  widthCm: string | null | undefined,
  heightCm: string | null | undefined
): string {
  const volume = computeVolumeCm3FromDimensions(lengthCm, widthCm, heightCm);
  if (!volume) {
    return "Enter length, width, and height to calculate volume.";
  }
  return `Volume: ${volume} cm³ (length × width × height)`;
}
