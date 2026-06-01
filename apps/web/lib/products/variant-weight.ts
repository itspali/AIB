/** Canonical variant mass for shipping (kg), stored as item_variants.dead_weight_kg. */
export function resolveDeadWeightKg(
  deadWeightKg: string | number | null | undefined,
  legacyWeight?: string | number | null | undefined
): string {
  const dead = Number(deadWeightKg ?? 0);
  if (Number.isFinite(dead) && dead > 0) {
    return typeof deadWeightKg === "string" ? deadWeightKg.trim() : String(dead);
  }
  const legacy = Number(legacyWeight ?? 0);
  if (Number.isFinite(legacy) && legacy > 0) {
    return typeof legacyWeight === "string" ? legacyWeight.trim() : String(legacy);
  }
  return "0";
}
