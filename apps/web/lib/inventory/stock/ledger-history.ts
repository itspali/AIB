import type { SupabaseClient } from "@supabase/supabase-js";

export type InventoryLedgerHistoryRow = {
  id: string;
  variant_id: string;
  transaction_type: string;
  quantity: string;
  cost_at_transaction: string;
  reference_document: string;
  created_at: string;
};

const DEFAULT_LIMIT_PER_VARIANT = 15;
const MAX_FETCH_ROWS = 250;

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

export async function fetchVariantStockLedgerHistory(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    location_id: string;
    variant_ids: string[];
    limit_per_variant?: number;
  }
): Promise<Record<string, InventoryLedgerHistoryRow[]>> {
  const locationId = input.location_id.trim();
  const variantIds = [...new Set(input.variant_ids.map((id) => id.trim()).filter(Boolean))];
  const limitPerVariant = input.limit_per_variant ?? DEFAULT_LIMIT_PER_VARIANT;

  if (!locationId || variantIds.length === 0) return {};

  const { data, error } = await supabase
    .from("inventory_ledger")
    .select(
      "id, variant_id, transaction_type, quantity, cost_at_transaction, reference_document, created_at"
    )
    .eq("tenant_id", tenantId)
    .eq("location_id", locationId)
    .in("variant_id", variantIds)
    .order("created_at", { ascending: false })
    .limit(MAX_FETCH_ROWS);

  if (error) throw new Error(error.message);

  const grouped: Record<string, InventoryLedgerHistoryRow[]> = {};
  for (const variantId of variantIds) {
    grouped[variantId] = [];
  }

  for (const row of data ?? []) {
    const variantId = row.variant_id as string;
    const bucket = grouped[variantId];
    if (!bucket || bucket.length >= limitPerVariant) continue;

    bucket.push({
      id: row.id as string,
      variant_id: variantId,
      transaction_type: String(row.transaction_type ?? ""),
      quantity: formatDecimal(row.quantity),
      cost_at_transaction: formatDecimal(row.cost_at_transaction),
      reference_document: String(row.reference_document ?? ""),
      created_at: row.created_at as string,
    });
  }

  return grouped;
}
