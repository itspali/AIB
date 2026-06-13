import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoEntitlementStatus = "OPEN" | "PARTIAL" | "CLOSED" | "WRITTEN_OFF";

export type PoPromoEntitlementRow = {
  id: string;
  purchase_order_id: string;
  promo_line_id: string;
  paid_line_id: string;
  promo_group_id: string;
  expected_qty: string;
  received_qty: string;
  status: PromoEntitlementStatus;
  written_off_at: string | null;
  written_off_reason: string | null;
  item_name: string;
  variant_sku: string;
  variant_id: string;
};

type EntitlementDbRow = {
  id: string;
  purchase_order_id: string;
  promo_line_id: string;
  paid_line_id: string;
  promo_group_id: string;
  expected_qty: number | string;
  received_qty: number | string;
  status: PromoEntitlementStatus;
  written_off_at: string | null;
  written_off_reason: string | null;
};

type PromoLineDbRow = {
  id: string;
  variant_id: string;
  items: { name: string } | { name: string }[] | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function resolveJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatQty(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toFixed(4).replace(/\.?0+$/, "") || "0";
}

export function promoEntitlementStatusLabel(status: PromoEntitlementStatus): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "PARTIAL":
      return "Partial";
    case "CLOSED":
      return "Closed";
    case "WRITTEN_OFF":
      return "Written off";
    default:
      return status;
  }
}

export function resolvePromoEntitlementRemainingQty(entitlement: Pick<
  PoPromoEntitlementRow,
  "expected_qty" | "received_qty"
>): number {
  const expected = Number(entitlement.expected_qty);
  const received = Number(entitlement.received_qty);
  if (!Number.isFinite(expected) || !Number.isFinite(received)) return 0;
  return Math.max(expected - received, 0);
}

export function isOpenPromoEntitlement(entitlement: PoPromoEntitlementRow): boolean {
  if (entitlement.status === "WRITTEN_OFF" || entitlement.status === "CLOSED") {
    return false;
  }
  return resolvePromoEntitlementRemainingQty(entitlement) > 0;
}

export function hasOpenPromoEntitlements(entitlements: readonly PoPromoEntitlementRow[]): boolean {
  return entitlements.some(isOpenPromoEntitlement);
}

function mapEntitlementRow(
  row: EntitlementDbRow,
  promoLine: PromoLineDbRow | null
): PoPromoEntitlementRow | null {
  if (!promoLine) return null;
  const item = resolveJoin(promoLine.items);
  const variant = resolveJoin(promoLine.item_variants);

  return {
    id: row.id,
    purchase_order_id: row.purchase_order_id,
    promo_line_id: row.promo_line_id,
    paid_line_id: row.paid_line_id,
    promo_group_id: row.promo_group_id,
    expected_qty: formatQty(row.expected_qty),
    received_qty: formatQty(row.received_qty),
    status: row.status,
    written_off_at: row.written_off_at,
    written_off_reason: row.written_off_reason,
    item_name: item?.name?.trim() || "Item",
    variant_sku: variant?.sku?.trim() || "",
    variant_id: promoLine.variant_id,
  };
}

export async function fetchPoPromoEntitlements(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<PoPromoEntitlementRow[]> {
  const { data: entitlementRows, error } = await supabase
    .from("promo_fulfillment_entitlements")
    .select(
      `
      id,
      purchase_order_id,
      promo_line_id,
      paid_line_id,
      promo_group_id,
      expected_qty,
      received_qty,
      status,
      written_off_at,
      written_off_reason
    `
    )
    .eq("tenant_id", tenantId)
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (entitlementRows ?? []) as EntitlementDbRow[];
  if (rows.length === 0) return [];

  const promoLineIds = [...new Set(rows.map((row) => row.promo_line_id))];
  const { data: promoLines, error: lineError } = await supabase
    .from("purchase_order_items")
    .select(
      `
      id,
      variant_id,
      items!purchase_order_items_item_tenant_fk (name),
      item_variants!purchase_order_items_variant_tenant_fk (sku)
    `
    )
    .eq("tenant_id", tenantId)
    .in("id", promoLineIds);

  if (lineError) {
    throw new Error(lineError.message);
  }

  const lineById = new Map(
    ((promoLines ?? []) as PromoLineDbRow[]).map((line) => [line.id, line])
  );

  return rows
    .map((row) => mapEntitlementRow(row, lineById.get(row.promo_line_id) ?? null))
    .filter((row): row is PoPromoEntitlementRow => row !== null);
}
