import type { SupabaseClient } from "@supabase/supabase-js";

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

export type LocationVariantReservationKey = `${string}:${string}`;

export function locationVariantReservationKey(
  locationId: string,
  variantId: string
): LocationVariantReservationKey {
  return `${locationId}:${variantId}`;
}

export async function fetchActiveReservationTotalsByLocationVariant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<LocationVariantReservationKey, string>> {
  const { data, error } = await supabase
    .from("inventory_reservations")
    .select("location_id, variant_id, quantity_reserved")
    .eq("tenant_id", tenantId)
    .eq("status", "ACTIVE");

  if (error) throw new Error(error.message);

  const totals = new Map<LocationVariantReservationKey, number>();

  for (const row of data ?? []) {
    const locationId = row.location_id as string;
    const variantId = row.variant_id as string;
    const key = locationVariantReservationKey(locationId, variantId);
    const qty = Number(row.quantity_reserved ?? 0);
    totals.set(key, (totals.get(key) ?? 0) + (Number.isFinite(qty) ? qty : 0));
  }

  const formatted = new Map<LocationVariantReservationKey, string>();
  for (const [key, value] of totals) {
    formatted.set(key, formatDecimal(value, "0"));
  }

  return formatted;
}

export function computeAvailableQuantity(onHand: string, reserved: string): string {
  const onHandNum = Number(onHand);
  const reservedNum = Number(reserved);
  if (!Number.isFinite(onHandNum) || !Number.isFinite(reservedNum)) return onHand;
  return formatDecimal(onHandNum - reservedNum, "0");
}
