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
