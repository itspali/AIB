import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterCatalogRowsInMemory,
  type CatalogSearchRow,
} from "@/lib/search/executor/apply-ast-in-memory";
import type { AstClause } from "@/lib/search/types";

const VIEW_NAME = "product_catalog_search_rows";

export async function executeItemsFilterRpc(
  supabase: SupabaseClient,
  tenantId: string,
  ast: AstClause[]
): Promise<string[]> {
  const structural = ast.filter((c) => c.kind !== "text");
  if (!structural.length && !ast.some((c) => c.kind === "text")) return [];

  const { data, error } = await supabase.rpc("execute_product_filter", {
    p_ast: structural,
  });

  if (!error) {
    if (Array.isArray(data)) {
      if (data.length === 0) return [];
      if (typeof data[0] === "string") return data as string[];
      return (data as { item_id: string }[]).map((row) => row.item_id);
    }
    return [];
  }

  console.warn("[search] RPC execute_product_filter failed, using view fallback:", error.message);

  const { data: rows, error: viewError } = await supabase
    .from(VIEW_NAME)
    .select(
      "item_id, name, description, category_id, category_name, hsn_sac_code, base_unit_of_measure, created_at, default_sku, selling_price, purchase_price"
    )
    .eq("tenant_id", tenantId);

  if (viewError) {
    throw new Error(viewError.message);
  }

  return filterCatalogRowsInMemory((rows ?? []) as CatalogSearchRow[], ast);
}

export async function resolveCategoryNamesToIds(
  supabase: SupabaseClient,
  tenantId: string,
  categoryName: string,
  mode: "exact" | "contains" = "exact"
): Promise<string[]> {
  let query = supabase
    .from("item_categories")
    .select("id")
    .eq("tenant_id", tenantId);

  if (mode === "contains") {
    const pattern = categoryName.replace(/[%_]/g, "");
    query = query.ilike("name", `%${pattern}%`);
  } else {
    query = query.ilike("name", categoryName);
  }

  const { data } = await query;
  return (data ?? []).map((row) => row.id as string);
}

export async function normalizeItemsAst(
  supabase: SupabaseClient,
  tenantId: string,
  ast: AstClause[]
): Promise<AstClause[]> {
  const normalized: AstClause[] = [];

  for (const clause of ast) {
    if (clause.kind === "predicate" && clause.field === "category_name") {
      if (clause.operator === "EQ") {
        const categoryIds = await resolveCategoryNamesToIds(
          supabase,
          tenantId,
          String(clause.value),
          "exact"
        );
        if (categoryIds.length === 1) {
          normalized.push({
            kind: "predicate",
            field: "category_id",
            operator: "EQ",
            value: categoryIds[0],
          });
          continue;
        }
        if (categoryIds.length > 1) {
          normalized.push({
            kind: "predicate",
            field: "category_id",
            operator: "IN",
            value: categoryIds,
          });
          continue;
        }
      }

      if (clause.operator === "ILIKE") {
        normalized.push(clause);
        continue;
      }

      if (clause.operator === "IN" && Array.isArray(clause.value)) {
        normalized.push(clause);
        continue;
      }
    }
    normalized.push(clause);
  }

  return normalized;
}
