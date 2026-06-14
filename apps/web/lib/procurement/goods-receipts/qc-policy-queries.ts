import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveCategoryQcPolicy,
  type QcReceiptPolicy,
  type VariantQcPolicyHint,
} from "@/lib/procurement/qc-receipt-policy";

const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";

type VariantRow = {
  id: string;
  item_id: string;
  items:
    | {
        qc_receipt_policy: QcReceiptPolicy;
        category_id: string | null;
        item_categories: { qc_receipt_policy: QcReceiptPolicy } | { qc_receipt_policy: QcReceiptPolicy }[] | null;
      }
    | {
        qc_receipt_policy: QcReceiptPolicy;
        category_id: string | null;
        item_categories: { qc_receipt_policy: QcReceiptPolicy } | { qc_receipt_policy: QcReceiptPolicy }[] | null;
      }[]
    | null;
};

function resolveItemEmbed(raw: VariantRow["items"]) {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

function resolveCategoryEmbed(
  raw: { qc_receipt_policy: QcReceiptPolicy } | { qc_receipt_policy: QcReceiptPolicy }[] | null | undefined
): QcReceiptPolicy | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  return row?.qc_receipt_policy ?? null;
}

export async function fetchVariantQcPolicyHints(
  supabase: SupabaseClient,
  tenantId: string,
  variantIds: string[]
): Promise<Record<string, VariantQcPolicyHint>> {
  const uniqueIds = [...new Set(variantIds.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabase
    .from("item_variants")
    .select(
      `
      id,
      item_id,
      ${VARIANT_ITEM_EMBED}!inner (
        qc_receipt_policy,
        category_id,
        item_categories!items_category_tenant_fk ( qc_receipt_policy )
      )
    `
    )
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);

  const categories = await loadCategoryTreePolicies(
    supabase,
    tenantId,
    (data ?? [])
      .map((row) => resolveItemEmbed((row as VariantRow).items)?.category_id)
      .filter((id): id is string => Boolean(id))
  );

  const result: Record<string, VariantQcPolicyHint> = {};
  for (const row of data ?? []) {
    const typed = row as VariantRow;
    const item = resolveItemEmbed(typed.items);
    if (!item) continue;
    const directCategoryPolicy = resolveCategoryEmbed(item.item_categories);
    const categoryPolicy =
      item.category_id != null
        ? effectiveCategoryQcPolicy(item.category_id, categories, directCategoryPolicy)
        : directCategoryPolicy;

    result[row.id as string] = {
      variant_id: row.id as string,
      item_id: row.item_id as string,
      item_policy: item.qc_receipt_policy,
      category_policy: categoryPolicy,
    };
  }

  return result;
}

type CategoryPolicyRow = {
  id: string;
  parent_id: string | null;
  qc_receipt_policy: QcReceiptPolicy;
};

async function loadCategoryTreePolicies(
  supabase: SupabaseClient,
  tenantId: string,
  seedCategoryIds: string[]
): Promise<Map<string, CategoryPolicyRow>> {
  const { data, error } = await supabase
    .from("item_categories")
    .select("id, parent_id, qc_receipt_policy")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);

  const map = new Map<string, CategoryPolicyRow>();
  for (const row of data ?? []) {
    map.set(row.id as string, {
      id: row.id as string,
      parent_id: row.parent_id as string | null,
      qc_receipt_policy: row.qc_receipt_policy as QcReceiptPolicy,
    });
  }

  // Ensure ancestors of seeded categories are present (already loaded all tenant categories).
  void seedCategoryIds;
  return map;
}
