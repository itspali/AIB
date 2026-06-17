import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAvailableQuantity } from "@/lib/inventory/stock/reservation-totals";
import { isMissingRpcError } from "@/lib/supabase/rpc-error";

const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";

export type DocumentLineStockContext = {
  quantity_on_hand: string;
  quantity_reserved?: string;
  quantity_available?: string;
  base_unit_of_measure: string;
  reorder_point: string | null;
  below_reorder: boolean;
};

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

function resolveJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function extractReorderPoint(customFields: Record<string, unknown> | null | undefined): string | null {
  if (!customFields) return null;
  const raw = customFields.reorder_point ?? customFields.reorder_point_qty;
  if (raw == null) return null;
  const text = String(raw).trim();
  return text || null;
}

export function resolveDocumentLineStockBelowReorder(
  quantityOnHand: string,
  reorderPoint: string | null
): boolean {
  if (reorderPoint == null) return false;
  const onHandNum = Number(quantityOnHand);
  const reorderNum = Number(reorderPoint);
  return (
    Number.isFinite(onHandNum) &&
    Number.isFinite(reorderNum) &&
    onHandNum <= reorderNum
  );
}

export async function fetchDocumentLineStockContexts(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    location_id: string;
    variant_ids: string[];
    /** Skip reservation RPC when only on-hand hints are needed (e.g. transfers). */
    scope?: "full" | "on_hand";
  }
): Promise<Record<string, DocumentLineStockContext>> {
  const locationId = input.location_id.trim();
  const variantIds = [...new Set(input.variant_ids.map((id) => id.trim()).filter(Boolean))];
  if (!locationId || variantIds.length === 0) return {};

  const includeAvailability = input.scope !== "on_hand";

  const [variantsResult, valuationsResult] = await Promise.all([
    supabase
      .from("item_variants")
      .select(
        `
        id,
        ${VARIANT_ITEM_EMBED}!inner (
          base_unit_of_measure,
          track_inventory,
          custom_fields
        )
      `
      )
      .eq("tenant_id", tenantId)
      .in("id", variantIds)
      .eq("is_active", true),
    supabase
      .from("item_valuations")
      .select("variant_id, total_quantity_on_hand")
      .eq("tenant_id", tenantId)
      .eq("location_id", locationId)
      .in("variant_id", variantIds),
  ]);

  if (variantsResult.error) throw new Error(variantsResult.error.message);
  if (valuationsResult.error) throw new Error(valuationsResult.error.message);

  const onHandByVariant = new Map<string, string>();
  for (const row of valuationsResult.data ?? []) {
    const variantId = row.variant_id as string;
    onHandByVariant.set(variantId, formatDecimal(row.total_quantity_on_hand, "0"));
  }

  const availabilityByVariant = new Map<
    string,
    { quantity_on_hand: string; quantity_reserved: string; quantity_available: string }
  >();

  if (includeAvailability) {
    const { data: availabilityRows, error: availabilityError } = await supabase.rpc(
      "get_variant_availability_at_location",
      {
        p_location_id: locationId,
        p_variant_ids: variantIds,
      }
    );

    if (!availabilityError && availabilityRows) {
      for (const row of availabilityRows as Array<{
        variant_id: string;
        quantity_on_hand: number | string;
        quantity_reserved: number | string;
        quantity_available: number | string;
      }>) {
        availabilityByVariant.set(row.variant_id, {
          quantity_on_hand: formatDecimal(row.quantity_on_hand, "0"),
          quantity_reserved: formatDecimal(row.quantity_reserved, "0"),
          quantity_available: formatDecimal(row.quantity_available, "0"),
        });
      }
    } else if (availabilityError && !isMissingRpcError(availabilityError)) {
      throw new Error(availabilityError.message);
    }
  }

  const contexts: Record<string, DocumentLineStockContext> = {};

  for (const row of variantsResult.data ?? []) {
    const variantId = row.id as string;
    const item = resolveJoin(
      (row as { items: unknown }).items as
        | {
            base_unit_of_measure: string;
            track_inventory: boolean;
            custom_fields: Record<string, unknown> | null;
          }
        | {
            base_unit_of_measure: string;
            track_inventory: boolean;
            custom_fields: Record<string, unknown> | null;
          }[]
        | null
    );
    if (!item?.track_inventory) continue;

    const quantityOnHand = onHandByVariant.get(variantId) ?? "0";
    const availability = availabilityByVariant.get(variantId);
    const quantityReserved = availability?.quantity_reserved ?? "0";
    const quantityAvailable =
      availability?.quantity_available ??
      computeAvailableQuantity(quantityOnHand, quantityReserved);
    const reorderPoint = extractReorderPoint(item.custom_fields);
    const belowReorderPoint = resolveDocumentLineStockBelowReorder(
      includeAvailability ? quantityAvailable : quantityOnHand,
      reorderPoint
    );

    contexts[variantId] = {
      quantity_on_hand: quantityOnHand,
      quantity_reserved: quantityReserved,
      quantity_available: quantityAvailable,
      base_unit_of_measure: item.base_unit_of_measure ?? "",
      reorder_point: reorderPoint,
      below_reorder: belowReorderPoint,
    };
  }

  return contexts;
}
