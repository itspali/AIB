import type { SupabaseClient } from "@supabase/supabase-js";
import type { PromotionalBatchRow } from "@/lib/procurement/promo/reclassification-helpers";

type RawBatchRow = {
  id: string;
  batch_number: string;
  status: string;
  quantity_total: number | string | null;
  notes: string | null;
  posted_at: string | null;
  created_at: string;
  promo_inventory_balances: Array<{ id: string }> | null;
};

function formatDecimal(value: number | string | null | undefined): string {
  if (value == null || value === "") return "0";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

function mapBatch(row: RawBatchRow): PromotionalBatchRow {
  const status = row.status;
  const normalizedStatus =
    status === "POSTED" || status === "CANCELLED" ? status : "DRAFT";

  return {
    id: row.id,
    batch_number: row.batch_number,
    status: normalizedStatus,
    quantity_total: formatDecimal(row.quantity_total),
    notes: row.notes,
    posted_at: row.posted_at,
    created_at: row.created_at,
    balance_count: row.promo_inventory_balances?.length ?? 0,
  };
}

export async function fetchPromotionalReclassificationBatches(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { status?: PromotionalBatchRow["status"] }
): Promise<PromotionalBatchRow[]> {
  let query = supabase
    .from("promotional_batches")
    .select(
      `
      id,
      batch_number,
      status,
      quantity_total,
      notes,
      posted_at,
      created_at,
      promo_inventory_balances ( id )
    `
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapBatch(row as RawBatchRow));
}
