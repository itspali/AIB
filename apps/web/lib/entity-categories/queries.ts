import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEntityCategoryWorkspaceConfig } from "@/lib/entity-categories/config";
import { parseAttributeTemplates } from "@/lib/entity-categories/tree";
import type { EntityCategoryRow, EntityCategoryWorkspace } from "@/lib/entity-categories/types";

const CATEGORY_SELECT =
  "id, name, parent_id, is_active, attribute_templates, inherit_parent_attributes, created_at, updated_at";

function mapEntityCategoryRow(row: {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: unknown;
  inherit_parent_attributes: boolean | null;
  created_at: string;
  updated_at: string;
}): EntityCategoryRow {
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    is_active: row.is_active,
    attribute_templates: parseAttributeTemplates(row.attribute_templates),
    inherit_parent_attributes: row.inherit_parent_attributes ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchEntityCategoryRows(
  supabase: SupabaseClient,
  tenantId: string,
  workspace: EntityCategoryWorkspace
): Promise<EntityCategoryRow[]> {
  const { table } = getEntityCategoryWorkspaceConfig(workspace);

  const { data, error } = await supabase
    .from(table)
    .select(CATEGORY_SELECT)
    .eq("tenant_id", tenantId)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => mapEntityCategoryRow(row));
}

export async function fetchEntityCategoryRowById(
  supabase: SupabaseClient,
  tenantId: string,
  workspace: EntityCategoryWorkspace,
  categoryId: string
): Promise<EntityCategoryRow | null> {
  const { table } = getEntityCategoryWorkspaceConfig(workspace);

  const { data, error } = await supabase
    .from(table)
    .select(CATEGORY_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .maybeSingle();

  if (error || !data) return null;
  return mapEntityCategoryRow(data);
}

/** Entity counts per category_id for delete validation in the UI. */
export async function fetchEntityCategoryCounts(
  supabase: SupabaseClient,
  tenantId: string,
  workspace: EntityCategoryWorkspace
): Promise<Record<string, number>> {
  const { countRpc, entityCategoryIdColumn } = getEntityCategoryWorkspaceConfig(workspace);

  const { data, error } = await supabase.rpc(countRpc);

  if (!error && data) {
    const counts: Record<string, number> = {};
    for (const row of data as { category_id: string; entity_count: number | string }[]) {
      counts[row.category_id] = Number(row.entity_count) || 0;
    }
    return counts;
  }

  const { data: rows, error: fallbackError } = await supabase
    .from("entities")
    .select(entityCategoryIdColumn)
    .eq("tenant_id", tenantId)
    .not(entityCategoryIdColumn, "is", null);

  if (fallbackError || !rows) return {};

  const counts: Record<string, number> = {};
  for (const row of rows) {
    const categoryId =
      entityCategoryIdColumn === "customer_category_id"
        ? (row as { customer_category_id: string | null }).customer_category_id
        : (row as { supplier_category_id: string | null }).supplier_category_id;
    if (!categoryId) continue;
    counts[categoryId] = (counts[categoryId] ?? 0) + 1;
  }
  return counts;
}
