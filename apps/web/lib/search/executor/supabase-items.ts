import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AstClause } from "@/lib/search/types";

export async function executeItemsFilterRpc(
  supabase: SupabaseClient,
  ast: AstClause[]
): Promise<string[]> {
  const structural = ast.filter((c) => c.kind !== "text");
  if (!structural.length) return [];

  const { data, error } = await supabase.rpc("execute_product_filter", {
    p_ast: structural,
  });
  if (error) throw error;

  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    if (typeof data[0] === "string") return data as string[];
    return (data as { item_id: string }[]).map((row) => row.item_id);
  }

  return [];
}

export async function resolveCategoryNameToId(
  supabase: SupabaseClient,
  tenantId: string,
  categoryName: string
): Promise<string | null> {
  const { data } = await supabase
    .from("item_categories")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("name", categoryName)
    .maybeSingle();

  return data?.id ?? null;
}

export async function normalizeItemsAst(
  supabase: SupabaseClient,
  tenantId: string,
  ast: AstClause[]
): Promise<AstClause[]> {
  const normalized: AstClause[] = [];

  for (const clause of ast) {
    if (clause.kind === "predicate" && clause.field === "category_name" && clause.operator === "EQ") {
      const categoryId = await resolveCategoryNameToId(
        supabase,
        tenantId,
        String(clause.value)
      );
      if (categoryId) {
        normalized.push({
          kind: "predicate",
          field: "category_id",
          operator: "EQ",
          value: categoryId,
        });
        continue;
      }
    }
    normalized.push(clause);
  }

  return normalized;
}
