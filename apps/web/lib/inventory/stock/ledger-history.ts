import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRpcError } from "@/lib/supabase/rpc-error";

export type InventoryLedgerHistoryRow = {
  id: string;
  variant_id: string;
  transaction_type: string;
  quantity: string;
  cost_at_transaction: string;
  reference_document: string;
  created_at: string;
  /** On-hand quantity after this ledger row (newest-first slice). */
  balance_after: string;
};

const DEFAULT_LIMIT_PER_VARIANT = 15;
const MAX_FETCH_ROWS = 250;

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

/** Newest-first entries; balance_after is on-hand after each row was posted. */
export function attachLedgerEntryBalances(
  entriesNewestFirst: Omit<InventoryLedgerHistoryRow, "balance_after">[],
  currentOnHand: number | string
): InventoryLedgerHistoryRow[] {
  let running = Number(currentOnHand);
  if (!Number.isFinite(running)) running = 0;

  return entriesNewestFirst.map((entry) => {
    const withBalance: InventoryLedgerHistoryRow = {
      ...entry,
      balance_after: formatDecimal(running),
    };
    const delta = Number(entry.quantity);
    if (Number.isFinite(delta)) {
      running -= delta;
    }
    return withBalance;
  });
}

export function resolveFetchLimit(variantCount: number, limitPerVariant: number): number {
  if (variantCount <= 0) return 0;
  return Math.min(MAX_FETCH_ROWS, limitPerVariant * variantCount);
}

type LedgerHistoryRpcRow = {
  id: string;
  variant_id: string;
  transaction_type: string;
  quantity: number | string;
  cost_at_transaction: number | string;
  reference_document: string;
  created_at: string;
  quantity_on_hand: number | string;
};

function mapLedgerRows(
  rows: LedgerHistoryRpcRow[],
  variantIds: string[],
  limitPerVariant: number
): Record<string, InventoryLedgerHistoryRow[]> {
  const grouped: Record<string, Omit<InventoryLedgerHistoryRow, "balance_after">[]> = {};
  const onHandByVariant = new Map<string, string>();

  for (const variantId of variantIds) {
    grouped[variantId] = [];
  }

  for (const row of rows) {
    const variantId = row.variant_id;
    if (!grouped[variantId]) continue;

    if (!onHandByVariant.has(variantId)) {
      onHandByVariant.set(variantId, formatDecimal(row.quantity_on_hand, "0"));
    }

    const bucket = grouped[variantId];
    if (bucket.length >= limitPerVariant) continue;

    bucket.push({
      id: row.id,
      variant_id: variantId,
      transaction_type: String(row.transaction_type ?? ""),
      quantity: formatDecimal(row.quantity),
      cost_at_transaction: formatDecimal(row.cost_at_transaction),
      reference_document: String(row.reference_document ?? ""),
      created_at: row.created_at,
    });
  }

  const withBalances: Record<string, InventoryLedgerHistoryRow[]> = {};
  for (const variantId of variantIds) {
    withBalances[variantId] = attachLedgerEntryBalances(
      grouped[variantId] ?? [],
      onHandByVariant.get(variantId) ?? "0"
    );
  }

  return withBalances;
}

async function fetchVariantStockLedgerHistoryViaRpc(
  supabase: SupabaseClient,
  input: {
    location_id: string;
    variant_ids: string[];
    limit_per_variant: number;
  }
): Promise<Record<string, InventoryLedgerHistoryRow[]> | null> {
  const { data, error } = await supabase.rpc("get_variant_stock_ledger_history", {
    p_location_id: input.location_id,
    p_variant_ids: input.variant_ids,
    p_limit_per_variant: input.limit_per_variant,
  });

  if (error) {
    if (isMissingRpcError(error)) return null;
    throw new Error(error.message);
  }

  return mapLedgerRows((data ?? []) as LedgerHistoryRpcRow[], input.variant_ids, input.limit_per_variant);
}

async function fetchVariantStockLedgerHistoryFallback(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    location_id: string;
    variant_ids: string[];
    limit_per_variant: number;
    on_hand_by_variant?: Record<string, string>;
  }
): Promise<Record<string, InventoryLedgerHistoryRow[]>> {
  const fetchLimit = resolveFetchLimit(input.variant_ids.length, input.limit_per_variant);
  const knownOnHand = input.on_hand_by_variant ?? {};

  const needsValuation = input.variant_ids.some((variantId) => knownOnHand[variantId] == null);

  const [ledgerResult, valuationResult] = await Promise.all([
    supabase
      .from("inventory_ledger")
      .select(
        "id, variant_id, transaction_type, quantity, cost_at_transaction, reference_document, created_at"
      )
      .eq("tenant_id", tenantId)
      .eq("location_id", input.location_id)
      .in("variant_id", input.variant_ids)
      .order("created_at", { ascending: false })
      .limit(fetchLimit),
    needsValuation
      ? supabase
          .from("item_valuations")
          .select("variant_id, total_quantity_on_hand")
          .eq("tenant_id", tenantId)
          .eq("location_id", input.location_id)
          .in("variant_id", input.variant_ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ledgerResult.error) throw new Error(ledgerResult.error.message);
  if (valuationResult.error) throw new Error(valuationResult.error.message);

  const onHandByVariant = new Map<string, string>();
  for (const variantId of input.variant_ids) {
    const known = knownOnHand[variantId];
    if (known != null) {
      onHandByVariant.set(variantId, formatDecimal(known, "0"));
    }
  }
  for (const row of valuationResult.data ?? []) {
    onHandByVariant.set(
      row.variant_id as string,
      formatDecimal(row.total_quantity_on_hand, "0")
    );
  }

  const grouped: Record<string, Omit<InventoryLedgerHistoryRow, "balance_after">[]> = {};
  for (const variantId of input.variant_ids) {
    grouped[variantId] = [];
  }

  for (const row of ledgerResult.data ?? []) {
    const variantId = row.variant_id as string;
    const bucket = grouped[variantId];
    if (!bucket || bucket.length >= input.limit_per_variant) continue;

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

  const withBalances: Record<string, InventoryLedgerHistoryRow[]> = {};
  for (const variantId of input.variant_ids) {
    withBalances[variantId] = attachLedgerEntryBalances(
      grouped[variantId] ?? [],
      onHandByVariant.get(variantId) ?? "0"
    );
  }

  return withBalances;
}

export async function fetchVariantStockLedgerHistory(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    location_id: string;
    variant_ids: string[];
    limit_per_variant?: number;
    on_hand_by_variant?: Record<string, string>;
  }
): Promise<Record<string, InventoryLedgerHistoryRow[]>> {
  const locationId = input.location_id.trim();
  const variantIds = [...new Set(input.variant_ids.map((id) => id.trim()).filter(Boolean))];
  const limitPerVariant = input.limit_per_variant ?? DEFAULT_LIMIT_PER_VARIANT;

  if (!locationId || variantIds.length === 0) return {};

  const rpcResult = await fetchVariantStockLedgerHistoryViaRpc(supabase, {
    location_id: locationId,
    variant_ids: variantIds,
    limit_per_variant: limitPerVariant,
  });
  if (rpcResult) return rpcResult;

  return fetchVariantStockLedgerHistoryFallback(supabase, tenantId, {
    location_id: locationId,
    variant_ids: variantIds,
    limit_per_variant: limitPerVariant,
    on_hand_by_variant: input.on_hand_by_variant,
  });
}
